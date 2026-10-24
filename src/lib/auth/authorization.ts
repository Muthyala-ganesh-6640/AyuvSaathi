import { store } from "@/lib/db/file-store";
import type { Profile, HealthcareConnection } from "@/lib/db/types";

export type RequiredPermission =
  | "viewRecords"
  | "viewPrescriptions"
  | "createPrescription"
  | "uploadReports"
  | "dispenseMedicines";

/**
 * Authoritative check to verify whether an authenticated actor has legitimate,
 * server-side authorization to access a patient's records or perform actions on their behalf.
 *
 * Rules:
 * 1. A patient can access their own profile.
 * 2. A patient can access their own registered family members.
 * 3. A healthcare professional (Doctor, Lab Tech, Pharmacist) can ONLY access a patient's records
 *    if there is an explicit, active HealthcareConnection where status === "active"
 *    and the requested permission is enabled in that connection grant.
 * 4. Revoked or non-existent connections immediately return FALSE.
 */
export async function canAccessPatientData(
  actor: Profile,
  patientProfileId: string,
  requiredPermission?: RequiredPermission,
): Promise<{ authorized: boolean; reason?: string; connection?: HealthcareConnection | null }> {
  if (!actor || !patientProfileId) {
    return { authorized: false, reason: "Missing actor or patient profile ID" };
  }

  // 1. Patient accessing their own record
  if (actor.id === patientProfileId) {
    return { authorized: true, reason: "Self access" };
  }

  // 2. Patient accessing their registered family member
  try {
    const familyMember = await store.getFamilyMember(patientProfileId);
    if (familyMember && familyMember.primaryUserId === actor.id) {
      return { authorized: true, reason: "Family member access" };
    }
  } catch {
    // ignore
  }

  // 3. Healthcare professional access via explicit collaboration connection
  if (actor.role && actor.role !== "patient") {
    try {
      const connection = await store.findConnection(patientProfileId, actor.id);

      if (!connection) {
        return {
          authorized: false,
          reason: `No collaboration grant exists between professional ${actor.id} and patient ${patientProfileId}`,
        };
      }

      if (connection.status !== "active") {
        return {
          authorized: false,
          reason: `Collaboration grant is ${connection.status}`,
          connection,
        };
      }

      // Check professional role alignment
      if (connection.professionalRole !== actor.role) {
        return {
          authorized: false,
          reason: `Role mismatch: connection is for ${connection.professionalRole}, actor is ${actor.role}`,
          connection,
        };
      }

      // Check specific permission if requested
      if (requiredPermission) {
        const hasPermission = Boolean(connection.permissions?.[requiredPermission]);
        if (!hasPermission) {
          return {
            authorized: false,
            reason: `Permission '${requiredPermission}' not granted in collaboration`,
            connection,
          };
        }
      }

      return { authorized: true, reason: "Active collaboration grant", connection };
    } catch {
      return { authorized: false, reason: "Error resolving collaboration grant" };
    }
  }

  return { authorized: false, reason: "Unauthorized" };
}

/**
 * Retrieves the list of patients EXPLICITLY shared with / assigned to a professional.
 * Prevents any global patient leakage: Unrelated doctors will see zero patients until
 * an explicit connection is established.
 */
export async function getAuthorizedPatientsForProfessional(professional: Profile) {
  if (!professional.id || professional.role === "patient") {
    return [];
  }

  const connections = await store.listProfessionalConnections(professional.id);
  const activeConnections = connections.filter((c) => c.status === "active");

  const patients = await Promise.all(
    activeConnections.map(async (conn) => {
      let patientName = "Authorized Patient";
      let ayuvSaathiId = "AS-P-XXXXX";
      let relationship = "self";
      let email: string | undefined;

      const profile = await store.getProfile(conn.patientProfileId);
      if (profile) {
        patientName = profile.displayName || profile.email.split("@")[0];
        ayuvSaathiId = profile.ayuvSaathiId || `AYUV-${profile.id.slice(0, 6).toUpperCase()}`;
        email = profile.email;
      } else {
        const fam = await store.getFamilyMember(conn.patientProfileId);
        if (fam) {
          patientName = fam.name;
          ayuvSaathiId = fam.ayuvSaathiId;
          relationship = fam.relationship;
        }
      }

      const [docs, prescriptions] = await Promise.all([
        store.listDocuments(conn.patientProfileId).catch(() => []),
        store.listPrescriptions(conn.patientProfileId).catch(() => []),
      ]);

      const labReports = docs.filter((d) => d.category === "lab_report" || d.category === "diagnostic_report");

      return {
        id: conn.patientProfileId,
        name: patientName,
        email,
        ayuvSaathiId,
        relationship,
        connectionId: conn.id,
        connectedAt: conn.createdAt,
        lastInteractionAt: conn.lastInteractionAt,
        permissions: conn.permissions,
        documentsCount: docs.length,
        labReportsCount: labReports.length,
        prescriptionsCount: prescriptions.length,
      };
    }),
  );

  return patients;
}
