import { z } from "zod";

const optional = z.string().optional().transform((v) => (v && v.trim() ? v.trim() : undefined));

const schema = z.object({
  NODE_ENV: z.string().optional(),
  AUTH_SECRET: optional,
  APP_URL: optional,
  NEXT_PUBLIC_SUPABASE_URL: optional,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optional,
  SUPABASE_SERVICE_ROLE_KEY: optional,
  AI_PROVIDER: optional,
  AI_API_KEY: optional,
  AI_MODEL: optional,
  AI_BASE_URL: optional,
  AI_TIMEOUT_MS: optional,
  GOOGLE_MAPS_API_KEY: optional,
  NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY: optional,
  SMTP_HOST: optional,
  SMTP_PORT: optional,
  SMTP_USER: optional,
  SMTP_PASSWORD: optional,
  SMTP_FROM: optional,
});

export type AppEnv = z.infer<typeof schema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("Invalid environment configuration.");
  }
  cached = parsed.data;
  return cached;
}

export function isSupabaseConfigured() {
  const env = getEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isAiConfigured() {
  const env = getEnv();
  return Boolean(env.AI_API_KEY);
}

export function isGooglePlacesConfigured() {
  return Boolean(getEnv().GOOGLE_MAPS_API_KEY);
}

export function isSmtpConfigured() {
  const env = getEnv();
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD && env.SMTP_FROM);
}

export function serviceStatus() {
  return {
    database: isSupabaseConfigured() ? ("supabase" as const) : ("local" as const),
    ai: isAiConfigured(),
    maps: isGooglePlacesConfigured() ? ("google" as const) : ("openstreetmap" as const),
    email: isSmtpConfigured(),
  };
}
