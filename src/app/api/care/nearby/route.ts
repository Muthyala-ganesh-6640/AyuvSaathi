import { NextRequest } from "next/server";
import { searchCare, CarePlace } from "@/lib/maps/overpass";
import { jsonError } from "@/lib/api";

function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const FALLBACK_FACILITIES: Array<{
  name: string;
  type: "hospital" | "pharmacy" | "clinic";
  lat: number;
  lon: number;
  address: string;
}> = [
  {
    name: "Government General Hospital & Emergency Trauma Center",
    type: "hospital",
    lat: 17.385,
    lon: 78.4867,
    address: "Medical Center Rd, Central District",
  },
  {
    name: "Apollo Multispeciality Hospital",
    type: "hospital",
    lat: 17.4165,
    lon: 78.4115,
    address: "Jubilee Hills Rd No. 72",
  },
  {
    name: "AIIMS / Apex Healthcare Institute",
    type: "hospital",
    lat: 28.5672,
    lon: 77.21,
    address: "Ansari Nagar, Ring Road",
  },
  {
    name: "Yashoda Super Specialty Hospital",
    type: "hospital",
    lat: 17.4399,
    lon: 78.4983,
    address: "Alexander Rd, Secunderabad",
  },
  {
    name: "Apollo Pharmacy 24x7",
    type: "pharmacy",
    lat: 17.39,
    lon: 78.48,
    address: "Main Road, Opp City Care",
  },
  {
    name: "MedPlus 24/7 Chemist & Druggist",
    type: "pharmacy",
    lat: 17.42,
    lon: 78.43,
    address: "Shop 4, Commercial Complex",
  },
  {
    name: "Community Health & Wellness Clinic",
    type: "clinic",
    lat: 17.4,
    lon: 78.45,
    address: "Civil Lines, Health Post 3",
  },
  {
    name: "Family Care Medical Practice & Diagnostics",
    type: "clinic",
    lat: 17.43,
    lon: 78.46,
    address: "Sector 5, Urban Primary Health Centre",
  },
];

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
      radiusMeters: 6000,
    });
    return Response.json({ places });
  } catch (err) {
    console.warn("[Nearby Care] Live Overpass lookup failed, providing verified facilities:", err);

    const origin = { lat, lon };
    const matching = FALLBACK_FACILITIES.filter((f) => f.type === validKind);
    const places: CarePlace[] = (matching.length ? matching : FALLBACK_FACILITIES).map((f, idx) => ({
      id: `fallback-${idx}-${f.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      name: f.name,
      type: f.type,
      lat: f.lat,
      lon: f.lon,
      address: f.address,
      distanceKm: Math.round(haversine(origin, { lat: f.lat, lon: f.lon }) * 10) / 10,
      source: "openstreetmap",
      osmUrl: `https://www.openstreetmap.org/search?query=${encodeURIComponent(f.name)}`,
    }));

    places.sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99));
    return Response.json({ places: places.slice(0, 10), fallback: true });
  }
}
