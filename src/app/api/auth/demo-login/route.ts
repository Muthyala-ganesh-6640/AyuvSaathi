import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/db/file-store";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { seedSyntheticData } from "@/lib/demo/seed";
import { getDashboardForRole } from "@/lib/auth/roles";
import { nowIso } from "@/lib/utils";
import type { UserRole } from "@/lib/db/types";

const schema = z.object({
  role: z.enum(["patient", "doctor"]).default("patient"),
  locale: z.enum(["en", "te", "hi"]).default("en"),
});

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  const role = parsed.success ? parsed.data.role : "patient";
  const locale = parsed.success ? parsed.data.locale : "en";

  const email = role === "doctor" ? "doctor@ayuvsaathi.in" : "patient.demo@ayuvsaathi.in";
  let profile = await store.getProfileByEmail(email);

  if (!profile) {
    const created = nowIso();
    const ayuvSaathiId = role === "doctor" ? "AS-DOC-DEMO1" : "AS-P-DEMO1";
    profile = await store.upsertProfile({
      id: crypto.randomUUID(),
      email,
      passwordHash: await hashPassword("Password123!"),
      displayName: role === "doctor" ? "Dr. K. Srinivas Rao, MD" : "Ramesh Kumar (Demo Patient)",
      role: role as UserRole,
      ayuvSaathiId,
      doctorProfile:
        role === "doctor"
          ? {
              medicalRegistrationNumber: "MCI-48921-A",
              specialization: "General Physician & Cardiologist",
              qualification: "MBBS, MD (Medicine)",
              experienceYears: 14,
              hospitalClinicName: "Apollo Health City",
              hospitalClinicAddress: "Road No. 72, Jubilee Hills, Hyderabad",
              department: "Internal Medicine",
              professionalEmail: "dr.srinivas@apollohealth.org",
              contactNumber: "+91 98490 12345",
              consultationAvailability: "Mon - Sat: 10:00 AM - 4:00 PM",
              verificationStatus: "verified",
            }
          : undefined,
      interfaceLanguage: locale,
      aiLanguage: "en",
      timezone: "Asia/Kolkata",
      notifyReminders: true,
      onboardingComplete: true,
      emailVerified: true,
      createdAt: created,
      updatedAt: created,
    });
  }

  // Ensure demo patient has rich medical records pre-loaded
  if (role === "patient") {
    const docs = await store.listDocuments(profile.id);
    if (docs.length === 0) {
      await seedSyntheticData(profile);
    }
  }

  const { cookieHeader } = await createSession(profile);
  const targetDashboard = getDashboardForRole(role as UserRole, locale);

  const response = Response.json({
    ok: true,
    role,
    user: {
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName,
      role: profile.role,
      ayuvSaathiId: profile.ayuvSaathiId,
    },
    targetDashboard,
  });

  if (cookieHeader) {
    response.headers.set("set-cookie", cookieHeader);
  }

  return response;
}
