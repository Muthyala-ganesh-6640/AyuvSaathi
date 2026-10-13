export type Locale = "en" | "te" | "hi";

export type DocumentCategory =
  | "lab_report"
  | "prescription"
  | "imaging"
  | "discharge_summary"
  | "doctor_visit"
  | "diagnostic_report"
  | "other";
export type ProcessingStatus =
  | "pending"
  | "processing"
  | "extracted"
  | "needs_review"
  | "manual"
  | "unconfigured"
  | "failed";
export type ConfirmationStatus = "unconfirmed" | "confirmed" | "rejected";
export type MedicationStatus = "active" | "paused" | "completed";
export type DoseStatus = "pending" | "taken" | "skipped" | "missed";
export type AppointmentStatus = "scheduled" | "completed" | "cancelled";
export type Provenance = "source_document" | "user_entered" | "synthetic_demo" | "ai_extracted";

export interface Profile {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  interfaceLanguage: Locale;
  aiLanguage: Locale;
  timezone: string;
  notifyReminders: boolean;
  onboardingComplete: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt?: string;
}

export interface MedicalDocument {
  id: string;
  ownerId: string;
  category: DocumentCategory;
  storagePath: string;
  displayName: string;
  mimeType: string;
  fileSize: number;
  uploadStatus: "uploaded" | "failed";
  processingStatus: ProcessingStatus;
  processingNote?: string;
  sourceDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Observation {
  id: string;
  ownerId: string;
  documentId: string;
  extractionId?: string;
  name: string;
  value: string;
  unit: string;
  referenceRange?: string;
  sourceDate?: string;
  page?: string;
  confidence?: number;
  uncertain: boolean;
  verificationStatus: ConfirmationStatus;
  provenance: Provenance;
  createdAt: string;
  updatedAt: string;
}

export interface Extraction {
  id: string;
  documentId: string;
  ownerId: string;
  structured: Record<string, unknown>;
  confidence?: number;
  validationStatus: "valid" | "invalid" | "partial";
  confirmationStatus: ConfirmationStatus;
  model?: string;
  notes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Medication {
  id: string;
  ownerId: string;
  name: string;
  strength: string;
  instructions: string;
  route?: string;
  startDate?: string;
  endDate?: string;
  source?: string;
  status: MedicationStatus;
  confirmationStatus: ConfirmationStatus;
  documentId?: string;
  provenance: Provenance;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationSchedule {
  id: string;
  medicationId: string;
  ownerId: string;
  times: string[];
  timezone: string;
  startDate: string;
  endDate?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DoseEvent {
  id: string;
  ownerId: string;
  medicationId: string;
  scheduleId: string;
  scheduledDate: string;
  scheduledTime: string;
  eventTime?: string;
  status: DoseStatus;
  source: "user" | "system";
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEvent {
  id: string;
  ownerId: string;
  type:
    | "document"
    | "prescription"
    | "medication"
    | "dose"
    | "appointment"
    | "visit"
    | "observation"
    | "discharge"
    | "consultation";
  relatedId?: string;
  eventDate: string;
  summary: string;
  provenance: Provenance;
  createdAt: string;
}

export interface VisitSummary {
  id: string;
  ownerId: string;
  title: string;
  sourceIds: string[];
  content: string;
  questions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  ownerId: string;
  title: string;
  facility?: string;
  startsAt: string;
  timezone: string;
  status: AppointmentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  ownerId: string;
  language: Locale;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  ownerId: string;
  role: "user" | "assistant" | "system";
  content: string;
  sourceRefs: string[];
  createdAt: string;
}

export interface DatabaseShape {
  profiles: Profile[];
  resetTokens: ResetToken[];
  documents: MedicalDocument[];
  extractions: Extraction[];
  observations: Observation[];
  medications: Medication[];
  schedules: MedicationSchedule[];
  doses: DoseEvent[];
  timeline: TimelineEvent[];
  visits: VisitSummary[];
  appointments: Appointment[];
  conversations: Conversation[];
  messages: ChatMessage[];
}

const DEFAULT_PROFILES: Profile[] = [
  {
    id: "a94873d8-dd8c-4229-aeb8-a7db24304c7a",
    email: "muthyalaganesh888@gmail.com",
    passwordHash: "$2b$12$aNyxMQKDLqv7.BZhaCrq5OdvjehbKIa0cAMKn7PsLMuuwgTSm7.Pi",
    displayName: "ganesh",
    interfaceLanguage: "en",
    aiLanguage: "en",
    timezone: "Asia/Calcutta",
    notifyReminders: true,
    onboardingComplete: false,
    emailVerified: false,
    createdAt: "2026-10-11T04:28:09.336Z",
    updatedAt: "2026-10-11T06:06:59.061Z",
  },
  {
    id: "006c4cad-d365-4ccc-aa62-9a3c29d60229",
    email: "24d01a6640@gmail.com",
    passwordHash: "$2b$12$ACDD36rvMg7Fqo90HO//SeRLH2/3kdPbp/1O7B9LqONIf9LzxSUi2",
    displayName: "ganesh",
    interfaceLanguage: "en",
    aiLanguage: "en",
    timezone: "Asia/Calcutta",
    notifyReminders: true,
    onboardingComplete: false,
    emailVerified: false,
    createdAt: "2026-10-12T08:30:02.495Z",
    updatedAt: "2026-10-12T08:30:02.495Z",
  },
  {
    id: "86e2f63b-c872-4e72-8e09-f0440a527c96",
    email: "ramesh@ayuvsaathi.in",
    passwordHash: "$2b$10$Tgy1Xd8FaZmRi8bUGFYB.OcCJCDtqBsSB0CL4vO0pARvmVn8j/jjK",
    displayName: "Ramesh Kumar",
    interfaceLanguage: "te",
    aiLanguage: "en",
    timezone: "Asia/Kolkata",
    notifyReminders: true,
    onboardingComplete: true,
    emailVerified: true,
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
  },
  {
    id: "bbec55b0-7d99-46c3-af28-a220756b8961",
    email: "sunita@ayuvsaathi.in",
    passwordHash: "$2b$10$Tgy1Xd8FaZmRi8bUGFYB.OcCJCDtqBsSB0CL4vO0pARvmVn8j/jjK",
    displayName: "Sunita Rao",
    interfaceLanguage: "en",
    aiLanguage: "en",
    timezone: "Asia/Kolkata",
    notifyReminders: true,
    onboardingComplete: true,
    emailVerified: true,
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
  },
  {
    id: "2c1e36ce-7f37-4e8d-9800-77697f1864f7",
    email: "doctor@ayuvsaathi.in",
    passwordHash: "$2b$10$pS//Q2cb/3shHD1KZ.kOlunImVnZ4MoIAcc0j3qq.XnmY9580yn3G",
    displayName: "Dr. K. Srinivas Rao, MD",
    interfaceLanguage: "en",
    aiLanguage: "en",
    timezone: "Asia/Kolkata",
    notifyReminders: true,
    onboardingComplete: true,
    emailVerified: true,
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
  },
  {
    id: "1412d944-7927-4e45-839e-efe5a3364c25",
    email: "ganesh@gmail.com",
    passwordHash: "$2b$12$3WANctLtqfWBSE.GQKik/OIIZtwV4G5C35AtKhvH5L.T03L5bb9zG",
    displayName: "ganesh",
    interfaceLanguage: "en",
    aiLanguage: "en",
    timezone: "Asia/Calcutta",
    notifyReminders: true,
    onboardingComplete: false,
    emailVerified: false,
    createdAt: "2026-10-13T01:48:21.285Z",
    updatedAt: "2026-10-13T01:48:21.285Z",
  },
];

export function emptyDatabase(): DatabaseShape {
  return {
    profiles: DEFAULT_PROFILES.map((p) => ({ ...p })),
    resetTokens: [],
    documents: [],
    extractions: [],
    observations: [],
    medications: [],
    schedules: [],
    doses: [],
    timeline: [],
    visits: [],
    appointments: [],
    conversations: [],
    messages: [],
  };
}