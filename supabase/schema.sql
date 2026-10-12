-- Arogya Co-pilot: Production PostgreSQL Schema with Row Level Security (RLS)
-- Suitable for Supabase PostgreSQL deployment

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  interface_language TEXT NOT NULL DEFAULT 'en' CHECK (interface_language IN ('en', 'te', 'hi')),
  ai_language TEXT NOT NULL DEFAULT 'en' CHECK (ai_language IN ('en', 'te', 'hi')),
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  notify_reminders BOOLEAN NOT NULL DEFAULT true,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Medical Documents Table
CREATE TABLE IF NOT EXISTS public.medical_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('lab_report', 'prescription', 'imaging', 'other')),
  storage_path TEXT NOT NULL,
  display_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  upload_status TEXT NOT NULL DEFAULT 'uploaded' CHECK (upload_status IN ('uploaded', 'failed')),
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'extracted', 'needs_review', 'manual', 'unconfigured', 'failed')),
  source_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Medical Extractions Table
CREATE TABLE IF NOT EXISTS public.medical_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.medical_documents(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  structured JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(4, 3),
  validation_status TEXT NOT NULL DEFAULT 'valid' CHECK (validation_status IN ('valid', 'invalid', 'partial')),
  confirmation_status TEXT NOT NULL DEFAULT 'unconfirmed' CHECK (confirmation_status IN ('unconfirmed', 'confirmed', 'rejected')),
  model TEXT,
  notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Medical Observations Table (Individual Test Results)
CREATE TABLE IF NOT EXISTS public.medical_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.medical_documents(id) ON DELETE CASCADE,
  extraction_id UUID REFERENCES public.medical_extractions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  reference_range TEXT,
  source_date DATE,
  page TEXT,
  confidence NUMERIC(4, 3),
  uncertain BOOLEAN NOT NULL DEFAULT false,
  verification_status TEXT NOT NULL DEFAULT 'unconfirmed' CHECK (verification_status IN ('unconfirmed', 'confirmed', 'rejected')),
  provenance TEXT NOT NULL DEFAULT 'ai_extracted' CHECK (provenance IN ('source_document', 'user_entered', 'synthetic_demo', 'ai_extracted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Medications Table
CREATE TABLE IF NOT EXISTS public.medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  strength TEXT NOT NULL,
  instructions TEXT NOT NULL,
  route TEXT,
  start_date DATE,
  end_date DATE,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  confirmation_status TEXT NOT NULL DEFAULT 'unconfirmed' CHECK (confirmation_status IN ('unconfirmed', 'confirmed', 'rejected')),
  document_id UUID REFERENCES public.medical_documents(id) ON DELETE SET NULL,
  provenance TEXT NOT NULL DEFAULT 'user_entered' CHECK (provenance IN ('source_document', 'user_entered', 'synthetic_demo', 'ai_extracted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Medication Schedules Table
CREATE TABLE IF NOT EXISTS public.medication_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  times JSONB NOT NULL DEFAULT '["09:00"]'::jsonb,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Dose Events Table
CREATE TABLE IF NOT EXISTS public.dose_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES public.medication_schedules(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  scheduled_time TEXT NOT NULL,
  event_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'taken', 'skipped', 'missed')),
  source TEXT NOT NULL DEFAULT 'system' CHECK (source IN ('user', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Health Timeline Table
CREATE TABLE IF NOT EXISTS public.health_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('document', 'prescription', 'medication', 'dose', 'appointment', 'visit', 'observation')),
  related_id UUID,
  event_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary TEXT NOT NULL,
  provenance TEXT NOT NULL DEFAULT 'user_entered' CHECK (provenance IN ('source_document', 'user_entered', 'synthetic_demo', 'ai_extracted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Doctor Visit Summaries Table
CREATE TABLE IF NOT EXISTS public.doctor_visit_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  content TEXT NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Appointments Table
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  facility TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Assistant Conversations Table
CREATE TABLE IF NOT EXISTS public.assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'te', 'hi')),
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Assistant Messages Table
CREATE TABLE IF NOT EXISTS public.assistant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.assistant_conversations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  source_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_documents_owner ON public.medical_documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_observations_owner_doc ON public.medical_observations(owner_id, document_id);
CREATE INDEX IF NOT EXISTS idx_medications_owner ON public.medications(owner_id);
CREATE INDEX IF NOT EXISTS idx_schedules_owner ON public.medication_schedules(owner_id);
CREATE INDEX IF NOT EXISTS idx_doses_owner_date ON public.dose_events(owner_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_timeline_owner ON public.health_timeline_events(owner_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_visits_owner ON public.doctor_visit_summaries(owner_id);
CREATE INDEX IF NOT EXISTS idx_appointments_owner ON public.appointments(owner_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON public.assistant_messages(conversation_id);

-- ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dose_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_visit_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES (Users only access their own records)
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can manage own documents" ON public.medical_documents FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Users can manage own extractions" ON public.medical_extractions FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Users can manage own observations" ON public.medical_observations FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Users can manage own medications" ON public.medications FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Users can manage own schedules" ON public.medication_schedules FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Users can manage own doses" ON public.dose_events FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Users can manage own timeline" ON public.health_timeline_events FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Users can manage own visit summaries" ON public.doctor_visit_summaries FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Users can manage own appointments" ON public.appointments FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Users can manage own conversations" ON public.assistant_conversations FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Users can manage own messages" ON public.assistant_messages FOR ALL USING (auth.uid() = owner_id);
