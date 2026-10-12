import { NextRequest } from "next/server";
import { geocode } from "@/lib/maps/overpass";
import { jsonError } from "@/lib/api";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  if (!q || !q.trim()) return jsonError("Provide a location search query.", 400);

  try {
    const result = await geocode(q.trim());
    if (!result) return jsonError("Location not found.", 404);
    return Response.json(result);
  } catch {
    return jsonError("Geocoding service unavailable.", 503);
  }
}
