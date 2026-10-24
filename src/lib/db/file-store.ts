import { randomBytes, createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import {
  Appointment,
  ChatMessage,
  Conversation,
  DatabaseShape,
  DoseEvent,
  Extraction,
  MedicalDocument,
  Medication,
  MedicationSchedule,
  Observation,
  Profile,
  ResetToken,
  TimelineEvent,
  VisitSummary,
  emptyDatabase,
} from "./types";

let activeDataDir: string | null = null;

export function getDataDir(): string {
  if (activeDataDir) return activeDataDir;
  if (process.env.DATA_DIR) {
    activeDataDir = process.env.DATA_DIR;
    return activeDataDir;
  }
  // On Vercel, AWS Lambda, or serverless environments, process.cwd() is read-only (/var/task).
  // os.tmpdir() (/tmp) is the only writable directory.
  if (
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    (process.env.NODE_ENV === "production" && process.platform !== "win32")
  ) {
    activeDataDir = path.join(os.tmpdir(), "ayuvsaathi-data");
    return activeDataDir;
  }
  activeDataDir = path.join(process.cwd(), ".data");
  return activeDataDir;
}

export function getStoreFile(): string {
  return path.join(getDataDir(), "store.json");
}

export function getUploadDir(): string {
  return path.join(getDataDir(), "uploads");
}

let queue: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function ensureDirs() {
  const dataDir = getDataDir();
  const uploadDir = getUploadDir();
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.mkdir(uploadDir, { recursive: true });
  } catch (error) {
    // If mkdir fails because process.cwd() or the path is read-only (EROFS / ENOENT / EACCES)
    const tmpDataDir = path.join(os.tmpdir(), "ayuvsaathi-data");
    if (dataDir !== tmpDataDir) {
      activeDataDir = tmpDataDir;
      await fs.mkdir(activeDataDir, { recursive: true });
      await fs.mkdir(path.join(activeDataDir, "uploads"), { recursive: true });
      return;
    }
    throw error;
  }
}

function mergeWithDefaults(parsed: Partial<DatabaseShape>): DatabaseShape {
  const base = emptyDatabase();
  const merged: DatabaseShape = { ...base, ...parsed };
  const byEmail = new Map<string, Profile>();
  for (const p of base.profiles) {
    byEmail.set(p.email.toLowerCase(), p);
  }
  if (Array.isArray(parsed.profiles)) {
    for (const p of parsed.profiles) {
      byEmail.set(p.email.toLowerCase(), p);
    }
  }
  merged.profiles = Array.from(byEmail.values());
  return merged;
}

async function readDb(): Promise<DatabaseShape> {
  await ensureDirs();
  const storeFile = getStoreFile();
  try {
    const raw = await fs.readFile(storeFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<DatabaseShape>;
    return mergeWithDefaults(parsed);
  } catch (error) {
    // If not found in primary store, check if there's a pre-bundled store.json in process.cwd()/.data
    const seedStoreFile = path.join(process.cwd(), ".data", "store.json");
    if (storeFile !== seedStoreFile) {
      try {
        const seedRaw = await fs.readFile(seedStoreFile, "utf8");
        const seedParsed = JSON.parse(seedRaw) as Partial<DatabaseShape>;
        const initial = mergeWithDefaults(seedParsed);
        await writeDb(initial).catch(() => undefined);
        return initial;
      } catch {
        // No seed file available, proceed
      }
    }

    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return emptyDatabase();
    }
    throw error;
  }
}

async function writeDb(db: DatabaseShape) {
  await ensureDirs();
  const storeFile = getStoreFile();
  const tmp = `${storeFile}.${randomBytes(6).toString("hex")}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  let renamed = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await fs.rename(tmp, storeFile);
      renamed = true;
      break;
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? (err as { code: string }).code : "";
      if (code === "EPERM" || code === "EBUSY") {
        await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
      } else {
        throw err;
      }
    }
  }
  if (!renamed) {
    try {
      await fs.copyFile(tmp, storeFile);
      await fs.unlink(tmp).catch(() => undefined);
    } catch {
      await fs.writeFile(storeFile, JSON.stringify(db, null, 2), "utf8");
      await fs.unlink(tmp).catch(() => undefined);
    }
  }
}

export async function mutate<T>(fn: (db: DatabaseShape) => T | Promise<T>): Promise<T> {
  return withLock(async () => {
    const db = await readDb();
    const result = await fn(db);
    await writeDb(db);
    return result;
  });
}

export async function query<T>(fn: (db: DatabaseShape) => T | Promise<T>): Promise<T> {
  return withLock(async () => {
    const db = await readDb();
    return fn(db);
  });
}

export async function saveUpload(ownerId: string, id: string, buffer: Buffer, ext: string) {
  await ensureDirs();
  const uploadDir = getUploadDir();
  const dir = path.join(uploadDir, ownerId);
  await fs.mkdir(dir, { recursive: true });
  const storagePath = path.join(ownerId, `${id}${ext}`);
  await fs.writeFile(path.join(uploadDir, storagePath), buffer);
  return storagePath;
}

export async function readUpload(storagePath: string) {
  const uploadDir = getUploadDir();
  const resolved = path.resolve(uploadDir, storagePath);
  const relative = path.relative(path.resolve(uploadDir), resolved);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error("Invalid storage path");
  }
  try {
    return await fs.readFile(resolved);
  } catch (error) {
    const seedUploadDir = path.join(process.cwd(), ".data", "uploads");
    if (uploadDir !== seedUploadDir) {
      try {
        const seedResolved = path.resolve(seedUploadDir, storagePath);
        return await fs.readFile(seedResolved);
      } catch {
        // ignore
      }
    }
    throw error;
  }
}

export async function deleteUpload(storagePath: string) {
  const uploadDir = getUploadDir();
  const resolved = path.resolve(uploadDir, storagePath);
  const relative = path.relative(path.resolve(uploadDir), resolved);
  if (
    !relative ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error("Invalid storage path");
  }
  try {
    await fs.unlink(resolved);
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }
    throw error;
  }
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const store = {
  getProfileByEmail: (email: string) =>
    query((db) => db.profiles.find((p) => p.email.toLowerCase() === email.toLowerCase()) ?? null),
  getProfile: (id: string) => query((db) => db.profiles.find((p) => p.id === id) ?? null),
  upsertProfile: (profile: Profile) =>
    mutate((db) => {
      const i = db.profiles.findIndex((p) => p.id === profile.id);
      if (i >= 0) db.profiles[i] = profile;
      else db.profiles.push(profile);
      return profile;
    }),
  addResetToken: (token: ResetToken) =>
    mutate((db) => {
      db.resetTokens.push(token);
      return token;
    }),
  consumeResetToken: (tokenHash: string) =>
    mutate((db) => {
      const row = db.resetTokens.find((t) => t.tokenHash === tokenHash && !t.usedAt);
      return row ?? null;
    }),
  listDocuments: (ownerId: string) =>
    query((db) =>
      db.documents
        .filter((d) => d.ownerId === ownerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ),
  getDocument: (id: string, ownerId: string) =>
    query((db) => db.documents.find((d) => d.id === id && d.ownerId === ownerId) ?? null),
  saveDocument: (doc: MedicalDocument) =>
    mutate((db) => {
      const i = db.documents.findIndex((d) => d.id === doc.id);
      if (i >= 0) db.documents[i] = doc;
      else db.documents.push(doc);
      return doc;
    }),
  deleteDocument: (id: string, ownerId: string) =>
    mutate(async (db) => {
      const doc = db.documents.find((d) => d.id === id && d.ownerId === ownerId);
      if (!doc) return false;
      db.documents = db.documents.filter((d) => d.id !== id);
      db.extractions = db.extractions.filter((e) => e.documentId !== id);
      db.observations = db.observations.filter((o) => o.documentId !== id);
      if (doc.storagePath) {
        await deleteUpload(doc.storagePath);
      }
      return true;
    }),
  saveExtraction: (row: Extraction) =>
    mutate((db) => {
      const i = db.extractions.findIndex((e) => e.id === row.id);
      if (i >= 0) db.extractions[i] = row;
      else db.extractions.push(row);
      return row;
    }),
  listExtractions: (documentId: string, ownerId: string) =>
    query((db) =>
      db.extractions.filter((e) => e.documentId === documentId && e.ownerId === ownerId),
    ),
  listObservations: (ownerId: string, documentId?: string) =>
    query((db) =>
      db.observations
        .filter((o) => o.ownerId === ownerId && (!documentId || o.documentId === documentId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ),
  saveObservation: (row: Observation) =>
    mutate((db) => {
      const i = db.observations.findIndex((o) => o.id === row.id);
      if (i >= 0) db.observations[i] = row;
      else db.observations.push(row);
      return row;
    }),
  getObservation: (id: string, ownerId: string) =>
    query((db) => db.observations.find((o) => o.id === id && o.ownerId === ownerId) ?? null),
  deleteObservation: (id: string, ownerId: string) =>
    mutate((db) => {
      const before = db.observations.length;
      db.observations = db.observations.filter((o) => !(o.id === id && o.ownerId === ownerId));
      return db.observations.length < before;
    }),
  listMedications: (ownerId: string) =>
    query((db) =>
      db.medications
        .filter((m) => m.ownerId === ownerId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    ),
  getMedication: (id: string, ownerId: string) =>
    query((db) => db.medications.find((m) => m.id === id && m.ownerId === ownerId) ?? null),
  saveMedication: (row: Medication) =>
    mutate((db) => {
      const i = db.medications.findIndex((m) => m.id === row.id);
      if (i >= 0) db.medications[i] = row;
      else db.medications.push(row);
      return row;
    }),
  deleteMedication: (id: string, ownerId: string) =>
    mutate((db) => {
      const found = db.medications.find((m) => m.id === id && m.ownerId === ownerId);
      if (!found) return false;
      db.medications = db.medications.filter((m) => m.id !== id);
      db.schedules = db.schedules.filter((s) => s.medicationId !== id);
      db.doses = db.doses.filter((d) => d.medicationId !== id);
      return true;
    }),
  listSchedules: (ownerId: string) =>
    query((db) => db.schedules.filter((s) => s.ownerId === ownerId)),
  saveSchedule: (row: MedicationSchedule) =>
    mutate((db) => {
      const i = db.schedules.findIndex((s) => s.id === row.id);
      if (i >= 0) db.schedules[i] = row;
      else db.schedules.push(row);
      return row;
    }),
  listDoses: (ownerId: string) =>
    query((db) => db.doses.filter((d) => d.ownerId === ownerId)),
  getDose: (id: string, ownerId: string) =>
    query((db) => db.doses.find((d) => d.id === id && d.ownerId === ownerId) ?? null),
  saveDose: (row: DoseEvent) =>
    mutate((db) => {
      const i = db.doses.findIndex((d) => d.id === row.id);
      if (i >= 0) db.doses[i] = row;
      else db.doses.push(row);
      return row;
    }),
  addTimeline: (row: TimelineEvent) =>
    mutate((db) => {
      db.timeline.push(row);
      return row;
    }),
  listTimeline: (ownerId: string) =>
    query((db) =>
      db.timeline
        .filter((t) => t.ownerId === ownerId)
        .sort((a, b) => b.eventDate.localeCompare(a.eventDate)),
    ),
  getTimelineEvent: (id: string, ownerId: string) =>
    query((db) => db.timeline.find((t) => t.id === id && t.ownerId === ownerId) ?? null),
  deleteTimelineEvent: (id: string, ownerId: string) =>
    mutate((db) => {
      const before = db.timeline.length;
      db.timeline = db.timeline.filter((t) => !(t.id === id && t.ownerId === ownerId));
      return db.timeline.length < before;
    }),
  listVisits: (ownerId: string) =>
    query((db) =>
      db.visits.filter((v) => v.ownerId === ownerId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    ),
  getVisit: (id: string, ownerId: string) =>
    query((db) => db.visits.find((v) => v.id === id && v.ownerId === ownerId) ?? null),
  saveVisit: (row: VisitSummary) =>
    mutate((db) => {
      const i = db.visits.findIndex((v) => v.id === row.id);
      if (i >= 0) db.visits[i] = row;
      else db.visits.push(row);
      return row;
    }),
  deleteVisit: (id: string, ownerId: string) =>
    mutate((db) => {
      const before = db.visits.length;
      db.visits = db.visits.filter((v) => !(v.id === id && v.ownerId === ownerId));
      return db.visits.length < before;
    }),
  listAppointments: (ownerId: string) =>
    query((db) =>
      db.appointments
        .filter((a) => a.ownerId === ownerId)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    ),
  getAppointment: (id: string, ownerId: string) =>
    query((db) => db.appointments.find((a) => a.id === id && a.ownerId === ownerId) ?? null),
  saveAppointment: (row: Appointment) =>
    mutate((db) => {
      const i = db.appointments.findIndex((a) => a.id === row.id);
      if (i >= 0) db.appointments[i] = row;
      else db.appointments.push(row);
      return row;
    }),
  deleteAppointment: (id: string, ownerId: string) =>
    mutate((db) => {
      const before = db.appointments.length;
      db.appointments = db.appointments.filter((a) => !(a.id === id && a.ownerId === ownerId));
      return db.appointments.length < before;
    }),
  listConversations: (ownerId: string) =>
    query((db) =>
      db.conversations
        .filter((c) => c.ownerId === ownerId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    ),
  getConversation: (id: string, ownerId: string) =>
    query((db) => db.conversations.find((c) => c.id === id && c.ownerId === ownerId) ?? null),
  saveConversation: (row: Conversation) =>
    mutate((db) => {
      const i = db.conversations.findIndex((c) => c.id === row.id);
      if (i >= 0) db.conversations[i] = row;
      else db.conversations.push(row);
      return row;
    }),
  listMessages: (conversationId: string, ownerId: string) =>
    query((db) =>
      db.messages
        .filter((m) => m.conversationId === conversationId && m.ownerId === ownerId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    ),
  addMessage: (row: ChatMessage) =>
    mutate((db) => {
      db.messages.push(row);
      return row;
    }),
  replaceOwnerData: (ownerId: string, patch: Partial<DatabaseShape>) =>
    mutate((db) => {
      (Object.keys(patch) as (keyof DatabaseShape)[]).forEach((key) => {
        const extra = (patch[key] ?? []) as unknown[];
        const current = db[key] as { ownerId?: string }[];
        const kept = current.filter((row) => row.ownerId !== ownerId);
        db[key] = [...kept, ...extra] as never;
      });
    }),
};