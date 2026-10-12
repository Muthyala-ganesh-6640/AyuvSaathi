import { NextRequest } from "next/server";
import { store } from "@/lib/db/file-store";
import { jsonError, withUser } from "@/lib/api";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;

  const conversation = await store.getConversation(id, auth.user.id);
  if (!conversation) return jsonError("Conversation not found.", 404);

  const messages = await store.listMessages(id, auth.user.id);
  return Response.json({ conversation, messages });
}
