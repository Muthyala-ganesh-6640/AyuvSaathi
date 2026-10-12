import { NextRequest } from "next/server";
import { readUpload, store } from "@/lib/db/file-store";
import { jsonError, withUser } from "@/lib/api";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;
  const { id } = await context.params;
  const document = await store.getDocument(id, auth.user.id);
  if (!document || !document.storagePath) return jsonError("Document not found.", 404);
  try {
    const data = await readUpload(document.storagePath);
    return new Response(data, {
      headers: {
        "content-type": document.mimeType,
        "content-disposition": `inline; filename="${document.displayName.replaceAll('"', "")}"`,
        "x-content-type-options": "nosniff",
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return jsonError("File is unavailable.", 404);
  }
}
