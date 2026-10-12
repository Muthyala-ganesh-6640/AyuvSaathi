import { z } from "zod";

const nominatimSchema = z.array(
  z.object({
    lat: z.string(),
    lon: z.string(),
    display_name: z.string(),
  }),
);

export type CarePlace = {
  id: string;
  name: string;
  type: "hospital" | "pharmacy" | "clinic";
  lat: number;
  lon: number;
  address?: string;
  distanceKm?: number;
  source: "openstreetmap";
  osmUrl: string;
};

function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export async function geocode(query: string) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  const res = await fetch(url, {
    headers: { "User-Agent": "ArogyaCopilot/1.0 (healthcare companion demo)" },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error("GEOCODE_FAILED");
  const parsed = nominatimSchema.safeParse(await res.json());
  if (!parsed.success || !parsed.data[0]) return null;
  return {
    lat: Number(parsed.data[0].lat),
    lon: Number(parsed.data[0].lon),
    label: parsed.data[0].display_name,
  };
}

export async function searchCare(input: {
  lat: number;
  lon: number;
  kind: "hospital" | "pharmacy" | "clinic";
  radiusMeters?: number;
}) {
  const radius = input.radiusMeters ?? 4000;
  const amenity =
    input.kind === "hospital" ? "hospital" : input.kind === "pharmacy" ? "pharmacy" : "clinic";
  const query = `[out:json][timeout:25];(node["amenity"="${amenity}"](around:${radius},${input.lat},${input.lon});way["amenity"="${amenity}"](around:${radius},${input.lat},${input.lon}););out center 30;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "User-Agent": "ArogyaCopilot/1.0" },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error("OVERPASS_FAILED");
  const data = (await res.json()) as {
    elements?: {
      id: number;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }[];
  };
  const origin = { lat: input.lat, lon: input.lon };
  const rawPlaces: (CarePlace | null)[] = (data.elements ?? []).map((el) => {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) return null;
    const name = el.tags?.name;
    if (!name) return null;
    const pos = { lat, lon };
    return {
      id: String(el.id),
      name,
      type: input.kind,
      lat,
      lon,
      address: [el.tags?.["addr:full"], el.tags?.["addr:street"], el.tags?.["addr:city"]]
        .filter(Boolean)
        .join(", "),
      distanceKm: Math.round(haversine(origin, pos) * 10) / 10,
      source: "openstreetmap" as const,
      osmUrl: `https://www.openstreetmap.org/${el.lat ? "node" : "way"}/${el.id}`,
    };
  });

  const places: CarePlace[] = rawPlaces.filter((p): p is CarePlace => p !== null);
  places.sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99));
  return places.slice(0, 20);
}
