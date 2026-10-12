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

export function emptyDatabase(): DatabaseShape {
  return {
    profiles: [],
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