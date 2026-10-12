import { NextRequest } from "next/server";
import { withUser } from "@/lib/api";
import { seedSyntheticData } from "@/lib/demo/seed";

export async function POST(request: NextRequest) {
  const auth = await withUser(request);
  if ("response" in auth) return auth.response;

  await seedSyntheticData(auth.user);
  return Response.json({ ok: true, message: "Synthetic demo data seeded successfully." });
}
