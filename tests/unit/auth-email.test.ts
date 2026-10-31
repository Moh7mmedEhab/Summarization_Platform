import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authOptions: null as unknown,
  send: vi.fn(),
}));

vi.mock("better-auth", () => ({
  betterAuth: (options: unknown) => {
    mocks.authOptions = options;
    return {};
  },
}));

vi.mock("better-auth/adapters/prisma", () => ({
  prismaAdapter: () => ({}),
}));

vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/env", () => ({
  env: () => ({
    APP_URL: "https://margins.example",
    BETTER_AUTH_SECRET: "test-secret",
  }),
}));

vi.mock("@/lib/email/mailer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email/mailer")>();
  return {
    ...actual,
    mailer: () => ({ send: mocks.send }),
  };
});

import "@/lib/auth/auth";

type AuthOptions = {
  emailAndPassword: {
    requireEmailVerification?: boolean;
    sendResetPassword: (input: {
      user: { email: string };
      url: string;
    }) => Promise<void>;
  };
  emailVerification: {
    sendVerificationEmail: (input: {
      user: { name: string; email: string };
      url: string;
    }) => Promise<void>;
  };
};

function authOptions(): AuthOptions {
  return mocks.authOptions as AuthOptions;
}

describe("authentication email safety", () => {
  beforeEach(() => {
    mocks.send.mockClear();
  });

  it("escapes untrusted names in verification email HTML", async () => {
    const name = '<img src=x onerror="alert(1)">';

    await authOptions().emailVerification.sendVerificationEmail({
      user: { name, email: "student@example.com" },
      url: "https://margins.example/en/verify-email?token=opaque",
    });

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"),
      }),
    );
    expect(mocks.send).not.toHaveBeenCalledWith(
      expect.objectContaining({ html: expect.stringContaining(name) }),
    );
  });

  it("requires email verification before sign-in", () => {
    expect(authOptions().emailAndPassword.requireEmailVerification).toBe(true);
  });
});
