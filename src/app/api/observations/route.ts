import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/db/file-store";
import { jsonError, withUser } from "@/lib/api";
import { nowIso } from "@/lib/utils";

const schemaCreate = z.object({
  documentId: z.string().uuid(),
  name: z.string().min(1).max(200),
  value: z.string().min(1).max(80),
  unit: z.string().max(40).optional().default(""),
  referenceRange: z.string().max(80).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;

  const [observations, documents] = await Promise.all([
    store.listObservations(auth.user.id),
    store.listDocuments(auth.user.id),
  ]);
  const documentNames = new Map(documents.map((document) => [document.id, document.displayName]));

  return Response.json({
    observations: observations.map((observation) => ({
      ...observation,
      sourceName: documentNames.get(observation.documentId) ?? "",
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const parsed = schemaCreate.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Enter a test name and the value shown on the document.", 400);
  const document = await store.getDocument(parsed.data.documentId, auth.user.id);
  if (!document) return jsonError("Document not found.", 404);
  const created = nowIso();
  const observation = await store.saveObservation({
    id: crypto.randomUUID(),
    ownerId: auth.user.id,
    documentId: document.id,
    name: parsed.data.name,
    value: parsed.data.value,
    unit: parsed.data.unit ?? "",
    referenceRange: parsed.data.referenceRange,
    uncertain: false,
    verificationStatus: "confirmed",
    provenance: "user_entered",
    createdAt: created,
    updatedAt: created,
  });
  return Response.json({ observation });
}
