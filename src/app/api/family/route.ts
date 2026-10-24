import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { store } from "@/lib/db/file-store";
import { jsonError } from "@/lib/api";
import type { FamilyMemberProfile } from "@/lib/db/types";

const familyMemberSchema = z.object({
  name: z.string().min(1).max(80),
  relationship: z.enum(["self", "father", "mother", "spouse", "child", "other"]),
  gender: z.enum(["male", "female", "other"]).optional(),
  dateOfBirth: z.string().optional(),
  bloodGroup: z.string().max(10).optional(),
  emergencyContact: z.string().max(30).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const members = await store.listFamilyMembers(user.id);
    return Response.json({ ok: true, familyMembers: members });
  } catch {
    return jsonError("Unauthorized", 401);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json().catch(() => null);
    const parsed = familyMemberSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid family member information", 400);
    }

    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const ayuvSaathiId = `AS-FAM-${randomSuffix}`;
    const now = new Date().toISOString();

    const member: FamilyMemberProfile = {
      id: crypto.randomUUID(),
      primaryUserId: user.id,
      name: parsed.data.name.trim(),
      relationship: parsed.data.relationship,
      gender: parsed.data.gender,
      dateOfBirth: parsed.data.dateOfBirth,
      bloodGroup: parsed.data.bloodGroup,
      emergencyContact: parsed.data.emergencyContact,
      ayuvSaathiId,
      createdAt: now,
      updatedAt: now,
    };

    await store.saveFamilyMember(member);

    // Also log audit event
    await store.logAudit({
      id: crypto.randomUUID(),
      actorId: user.id,
      actorRole: user.role || "patient",
      actorName: user.displayName,
      patientProfileId: member.id,
      action: "profile_switched",
      details: { addedFamilyMember: member.name, relationship: member.relationship },
      timestamp: now,
    });

    return Response.json({ ok: true, familyMember: member });
  } catch {
    return jsonError("Unauthorized", 401);
  }
}
