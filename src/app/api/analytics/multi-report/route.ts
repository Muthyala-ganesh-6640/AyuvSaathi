import { NextRequest } from "next/server";
import { store } from "@/lib/db/file-store";
import { withUser } from "@/lib/api";
import { generateMultiReportAnalytics } from "@/lib/medical/multi-report-analytics";

export async function GET(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;

  const [observations, documents, medications] = await Promise.all([
    store.listObservations(auth.user.id),
    store.listDocuments(auth.user.id),
    store.listMedications(auth.user.id),
  ]);

  const analytics = generateMultiReportAnalytics({
    observations,
    documents,
    medications,
  });

  return Response.json(analytics);
}
