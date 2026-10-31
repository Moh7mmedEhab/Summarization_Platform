import path from "node:path";
import { z } from "zod";

/**
 * Server-only environment configuration. `env()` throws a readable error on
 * startup when a required value is missing or malformed — never a cryptic
 * runtime failure deep inside a feature.
 */

const int = z.coerce.number().int().positive();

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (PostgreSQL connection string)"),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters (generate: openssl rand -base64 32)"),

  APP_URL: z.string().url().default("http://localhost:3000"),

  // AI: the key is optional at boot; summarization feature checks it lazily so a
  // missing key surfaces as a clear "configure GEMINI_API_KEY" error, not a crash.
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
  GEMINI_TRANSCRIBE_MODEL: z.string().default("gemini-3.5-transcribe"),

  EMAIL_PROVIDER: z.enum(["dev", "smtp"]).default("dev"),
  EMAIL_SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().default("Margins <no-reply@margins.local>"),

  // Resolved to an absolute path once, so web and worker processes agree on
  // the storage root even if started from different working directories.
  STORAGE_DIR: z
    .string()
    .default("./storage")
    .transform((v) => path.resolve(v)),
  MAX_UPLOAD_TOTAL_BYTES: int.default(104_857_600), // 100 MB across an upload's files + text
  UPLOAD_MAX_SOURCE_BYTES: int.default(52_428_800), // 50 MB
  UPLOAD_MAX_AUDIO_BYTES: int.default(52_428_800), // 50 MB
  UPLOAD_MAX_TEXT_CHARS: int.default(200_000),

  WORKER_POLL_INTERVAL_MS: int.default(2_000),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
