import { NextRequest } from "next/server";
import { z } from "zod";
import { store } from "@/lib/db/file-store";
import { hashPassword, passwordIssues } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { jsonError, limitOrThrow } from "@/lib/api";
import { clientIp, nowIso } from "@/lib/utils";
import type { Locale, UserRole } from "@/lib/db/types";

const schema = z.object({
  email: z.string().email(),
  password: z.string(),
  displayName: z.string().min(1).max(80),
  role: z.enum(["patient", "doctor", "lab_tech", "pharmacist"]).default("patient"),
  interfaceLanguage: z.enum(["en", "te", "hi"]).default("en"),
  timezone: z.string().max(80).optional(),
  doctorProfile: z.object({
    medicalRegistrationNumber: z.string(),
    specialization: z.string(),
    qualification: z.string(),
    experienceYears: z.number().optional(),
    hospitalClinicName: z.string(),
    hospitalClinicAddress: z.string(),
    department: z.string().optional(),
    professionalEmail: z.string().optional(),
    contactNumber: z.string(),
    consultationAvailability: z.string().optional(),
    verificationStatus: z.enum(["verified", "pending", "unverified"]).default("pending"),
  }).optional(),
  labTechProfile: z.object({
    technicianId: z.string(),
    qualification: z.string(),
    specialization: z.string().optional(),
    labName: z.string(),
    labRegistration: z.string().optional(),
    labAddress: z.string(),
    contactNumber: z.string(),
    professionalEmail: z.string().optional(),
    department: z.string().optional(),
    designation: z.string().optional(),
    verificationStatus: z.enum(["verified", "pending", "unverified"]).default("pending"),
  }).optional(),
  pharmacistProfile: z.object({
    licenseNumber: z.string(),
    qualification: z.string(),
    pharmacyName: z.string(),
    pharmacyAddress: z.string(),
    contactNumber: z.string(),
    professionalEmail: z.string().optional(),
    designation: z.string().optional(),
    verificationStatus: z.enum(["verified", "pending", "unverified"]).default("pending"),
  }).optional(),
});

export async function POST(request: NextRequest) {
  const limited = limitOrThrow(`signup:${clientIp(request.headers)}`, 8, 15 * 60_000);
  if (limited) return limited;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Please check the form and try again.", 400);
  const issues = passwordIssues(parsed.data.password);
  if (issues.length) return jsonError(issues.join(" "), 400);
  const existing = await store.getProfileByEmail(parsed.data.email);
  if (existing) return jsonError("An account with this email already exists.", 409);
  const created = nowIso();
  const role = parsed.data.role as UserRole;
  const prefix = role === "doctor" ? "AS-DOC" : role === "lab_tech" ? "AS-LAB" : role === "pharmacist" ? "AS-PHARM" : "AS-P";
  const ayuvSaathiId = `${prefix}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  const profile = await store.upsertProfile({
    id: crypto.randomUUID(),
    email: parsed.data.email.toLowerCase(),
    passwordHash: await hashPassword(parsed.data.password),
    displayName: parsed.data.displayName.trim(),
    role,
    ayuvSaathiId,
    doctorProfile: role === "doctor" ? parsed.data.doctorProfile : undefined,
    labTechProfile: role === "lab_tech" ? parsed.data.labTechProfile : undefined,
    pharmacistProfile: role === "pharmacist" ? parsed.data.pharmacistProfile : undefined,
    interfaceLanguage: parsed.data.interfaceLanguage as Locale,
    aiLanguage: parsed.data.interfaceLanguage as Locale,
    timezone: parsed.data.timezone || "Asia/Kolkata",
    notifyReminders: true,
    onboardingComplete: false,
    emailVerified: false,
    createdAt: created,
    updatedAt: created,
  });
  const { cookieHeader } = await createSession(profile);
  const response = Response.json({
    ok: true,
    language: profile.interfaceLanguage,
    role: profile.role || "patient",
  });
  if (cookieHeader) {
    response.headers.set("set-cookie", cookieHeader);
  }
  return response;
}
