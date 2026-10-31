/**
 * tests/unit/env.test.ts
 *
 * Unit tests for lib/env.ts — environment variable parsing and validation
 *
 * IMPORTANT: lib/env.ts caches the parsed result in module scope.
 * Vitest runs each test file in its own module context (isolate), so we
 * can safely mutate process.env before importing. Within this test file
 * we use a helper that resets module cache by re-importing dynamically.
 */

import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";

// ---------------------------------------------------------------------------
// Helper: re-import env() with the current process.env state.
// Vitest's module isolation means each dynamic import gets a fresh module
// evaluation, resetting the `cached` variable in lib/env.ts.
// ---------------------------------------------------------------------------
async function loadEnv() {
  // Force re-evaluation by clearing the cache via vi.resetModules
  const { vi } = await import("vitest");
  vi.resetModules();
  const mod = await import("@/lib/env");
  return mod.env;
}

// Save the original env to restore after each test
const originalEnv = { ...process.env };

beforeEach(() => {
  // Restore all env vars to the test-setup baseline
  // (setup.ts sets all required vars)
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/margins_test",
    BETTER_AUTH_SECRET: "test_secret_32_characters_minimum_string_for_testing_purposes",
    APP_URL: "http://localhost:3000",
    EMAIL_PROVIDER: "dev",
    STORAGE_DIR: "./storage/test_sandbox",
    GEMINI_API_KEY: "test_mock_gemini_key",
  });
});

describe("env() – valid configuration", () => {
  it("all valid values → env() succeeds", async () => {
    const env = await loadEnv();
    const result = env();
    expect(result.DATABASE_URL).toContain("postgresql://");
    expect(result.BETTER_AUTH_SECRET).toHaveLength(
      "test_secret_32_characters_minimum_string_for_testing_purposes".length
    );
    expect(result.APP_URL).toBe("http://localhost:3000");
    expect(result.EMAIL_PROVIDER).toBe("dev");
  });

  it("EMAIL_PROVIDER defaults to 'dev' when not set", async () => {
    delete process.env.EMAIL_PROVIDER;
    const env = await loadEnv();
    const result = env();
    expect(result.EMAIL_PROVIDER).toBe("dev");
  });

  it("STORAGE_DIR defaults to ./storage, resolved absolute (web+worker agree)", async () => {
    delete process.env.STORAGE_DIR;
    const env = await loadEnv();
    const result = env();
    expect(result.STORAGE_DIR).toBe(path.resolve("./storage"));
  });

  it("MAX_UPLOAD_TOTAL_BYTES defaults to 100 MB", async () => {
    delete process.env.MAX_UPLOAD_TOTAL_BYTES;
    const env = await loadEnv();
    expect(env().MAX_UPLOAD_TOTAL_BYTES).toBe(104_857_600);
  });

  it("APP_URL defaults to 'http://localhost:3000' when not set", async () => {
    delete process.env.APP_URL;
    const env = await loadEnv();
    const result = env();
    expect(result.APP_URL).toBe("http://localhost:3000");
  });

  it("UPLOAD_MAX_SOURCE_BYTES defaults to 52428800", async () => {
    delete process.env.UPLOAD_MAX_SOURCE_BYTES;
    const env = await loadEnv();
    const result = env();
    expect(result.UPLOAD_MAX_SOURCE_BYTES).toBe(52_428_800);
  });

  it("GEMINI_API_KEY is optional (can be empty string)", async () => {
    process.env.GEMINI_API_KEY = "";
    const env = await loadEnv();
    const result = env();
    expect(result.GEMINI_API_KEY).toBe("");
  });

  it("APP_URL must be a valid URL", async () => {
    process.env.APP_URL = "https://margins.example.com";
    const env = await loadEnv();
    const result = env();
    expect(result.APP_URL).toBe("https://margins.example.com");
  });

  it("EMAIL_PROVIDER smtp → parses", async () => {
    process.env.EMAIL_PROVIDER = "smtp";
    const env = await loadEnv();
    const result = env();
    expect(result.EMAIL_PROVIDER).toBe("smtp");
  });
});

describe("env() – invalid / missing required values", () => {
  it("missing DATABASE_URL → throws with DATABASE_URL in message", async () => {
    delete process.env.DATABASE_URL;
    const env = await loadEnv();
    expect(() => env()).toThrow(/DATABASE_URL/);
  });

  it("empty DATABASE_URL → throws", async () => {
    process.env.DATABASE_URL = "";
    const env = await loadEnv();
    expect(() => env()).toThrow();
  });

  it("BETTER_AUTH_SECRET shorter than 32 chars → throws with BETTER_AUTH_SECRET in message", async () => {
    process.env.BETTER_AUTH_SECRET = "tooshort";
    const env = await loadEnv();
    expect(() => env()).toThrow(/BETTER_AUTH_SECRET/);
  });

  it("BETTER_AUTH_SECRET exactly 32 chars → passes", async () => {
    process.env.BETTER_AUTH_SECRET = "a".repeat(32);
    const env = await loadEnv();
    expect(() => env()).not.toThrow();
  });

  it("BETTER_AUTH_SECRET with 31 chars → throws", async () => {
    process.env.BETTER_AUTH_SECRET = "a".repeat(31);
    const env = await loadEnv();
    expect(() => env()).toThrow();
  });

  it("invalid EMAIL_PROVIDER value → throws", async () => {
    process.env.EMAIL_PROVIDER = "sendgrid";
    const env = await loadEnv();
    expect(() => env()).toThrow();
  });

  it("invalid APP_URL (not a URL) → throws", async () => {
    process.env.APP_URL = "not-a-url";
    const env = await loadEnv();
    expect(() => env()).toThrow();
  });

  it("UPLOAD_MAX_SOURCE_BYTES as negative number → throws", async () => {
    process.env.UPLOAD_MAX_SOURCE_BYTES = "-1";
    const env = await loadEnv();
    expect(() => env()).toThrow();
  });

  it("UPLOAD_MAX_SOURCE_BYTES as non-integer float → throws", async () => {
    process.env.UPLOAD_MAX_SOURCE_BYTES = "1.5";
    const env = await loadEnv();
    expect(() => env()).toThrow();
  });

  it("error message is readable and mentions all failing fields", async () => {
    delete process.env.DATABASE_URL;
    process.env.BETTER_AUTH_SECRET = "short";
    const env = await loadEnv();
    try {
      env();
      expect.fail("Expected env() to throw");
    } catch (e: unknown) {
      const msg = (e as Error).message;
      expect(msg).toMatch(/Invalid environment configuration/);
      expect(msg).toMatch(/DATABASE_URL/);
      expect(msg).toMatch(/BETTER_AUTH_SECRET/);
    }
  });
});
