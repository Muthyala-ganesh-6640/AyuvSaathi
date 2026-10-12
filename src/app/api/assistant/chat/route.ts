import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/db/file-store";
import { jsonError, withUser } from "@/lib/api";
import { nowIso } from "@/lib/utils";
import { routing } from "@/i18n/routing";
import { isAiConfigured } from "@/lib/env";
import { assistantReply } from "@/lib/ai/provider";

const chatSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
  language: z.enum(routing.locales).optional().default(routing.defaultLocale),
});

export async function POST(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;

  const parsed = chatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Please enter a question.", 400);
  if (!isAiConfigured()) {
    return jsonError(
      "The AI assistant is not configured. Set AI_API_KEY on the server and try again.",
      503
    );
  }

  const [observations, medications] = await Promise.all([
    store.listObservations(auth.user.id),
    store.listMedications(auth.user.id),
  ]);

  const confirmedObs = observations.filter((o) => o.verificationStatus === "confirmed");
  const confirmedMeds = medications.filter((m) => m.confirmationStatus === "confirmed");

  // Format confirmed records text
  const recordsSummary = [
    ...confirmedObs.map(
      (o) =>
        `Test: ${o.name}, Value: ${o.value} ${o.unit}${
          o.referenceRange ? `, Reference Range: ${o.referenceRange}` : " (No range in source)"
        }`
    ),
    ...confirmedMeds.map(
      (m) => `Medication: ${m.name} (${m.strength}), Instructions: ${m.instructions}`
    ),
  ].join("\n");

  const conversationId = parsed.data.conversationId ?? crypto.randomUUID();
  const now = nowIso();

  // Use earlier turns as context; the current question is sent separately.
  const previousMessages = await store.listMessages(conversationId, auth.user.id);
  const history = previousMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  let res: Awaited<ReturnType<typeof assistantReply>>;
  try {
    res = await assistantReply({
      language: parsed.data.language,
      question: parsed.data.message,
      history: history.slice(-10),
      records: recordsSummary,
    });
  } catch (error) {
    console.error("[Assistant Chat] AI request failed:", error);
    return jsonError(
      "The AI assistant could not generate a response. Check the AI provider configuration and try again.",
      502
    );
  }

  if (!parsed.data.conversationId) {
    await store.saveConversation({
      id: conversationId,
      ownerId: auth.user.id,
      language: parsed.data.language,
      title: parsed.data.message.slice(0, 40) + "...",
      createdAt: now,
      updatedAt: now,
    });
  }

  await store.addMessage({
    id: crypto.randomUUID(),
    conversationId,
    ownerId: auth.user.id,
    role: "user",
    content: parsed.data.message,
    sourceRefs: [],
    createdAt: now,
  });

  const assistantNow = nowIso();
  const assistantMsg = await store.addMessage({
    id: crypto.randomUUID(),
    conversationId,
    ownerId: auth.user.id,
    role: "assistant",
    content: res.reply,
    sourceRefs: res.usedRecordIds,
    createdAt: assistantNow,
  });

  return Response.json({
    conversationId,
    message: assistantMsg,
    caution: res.caution ? "Clinical caution: Strictly informational, verify with clinician." : "",
  });
}