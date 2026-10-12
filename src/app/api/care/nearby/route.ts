import { NextRequest } from "next/server";
import { searchCare } from "@/lib/maps/overpass";
import { jsonError } from "@/lib/api";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const kind = searchParams.get("kind") as "hospital" | "pharmacy" | "clinic";

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return jsonError("Valid latitude and longitude are required.", 400);
  }

  const validKind = ["hospital", "pharmacy", "clinic"].includes(kind) ? kind : "hospital";

  try {
    const places = await searchCare({
      lat,
      lon,
      kind: validKind,
      radiusMeters: 5000,
    });
    return Response.json({ places });
  } catch {
    return jsonError("Could not retrieve nearby facilities at this time.", 502);
  }
}
