/**
 * Vitest global setup — stubs all required environment variables so
 * tests can import server modules without crashing on missing env.
 * NOTE: env.ts uses a module-level `cached` variable; we reset it via
 *       process.env mutation BEFORE any module that calls `env()` is
 *       imported.  Individual test files can override specific vars.
 */

// Reset the env cache in lib/env.ts between test files
// (vitest runs each test file in its own module scope via the default
//  "threads" pool so the module is re-evaluated fresh per file)

import "@testing-library/jest-dom/vitest";

process.env.DATABASE_URL = "postgresql://margins:margins@127.0.0.1:5433/margins_test?schema=public";
process.env.BETTER_AUTH_SECRET = "test_secret_32_characters_minimum_string_for_testing_purposes";
process.env.APP_URL = "http://localhost:3000";
process.env.EMAIL_PROVIDER = "dev";
process.env.STORAGE_DIR = "./storage/test_sandbox";
process.env.GEMINI_API_KEY = "test_mock_gemini_key";
process.env.GEMINI_MODEL = "gemini-3.8-flash";
process.env.GEMINI_TRANSCRIBE_MODEL = "gemini-3.5-transcribe";
process.env.UPLOAD_MAX_SOURCE_BYTES = "52428800";
process.env.UPLOAD_MAX_AUDIO_BYTES = "52428800";
process.env.UPLOAD_MAX_TEXT_CHARS = "200000";
process.env.WORKER_POLL_INTERVAL_MS = "2000";
