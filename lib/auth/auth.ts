import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { mailer, emailHtml } from "@/lib/email/mailer";

/**
 * Authentication: Better Auth (email + password) on Prisma.
 * Email verification and password reset run through the mailer abstraction;
 * verification / reset links point at the localized pages (/en/… or /ar/…).
 * UserPreference rows are created lazily when preferences are first read.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: env().APP_URL,
  secret: env().BETTER_AUTH_SECRET,
  trustedOrigins: [env().APP_URL],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 3600, // one hour
    sendResetPassword: async ({ user, url }) => {
      await mailer().send({
        to: user.email,
        subject: "Reset your Margins password",
        text:
          `Someone requested a password reset for your Margins account.\n\n` +
          `Open this link to choose a new password (valid for one hour):\n${url}\n\n` +
          `If you did not request this, ignore this email; your password stays unchanged.`,
        html: emailHtml(
          "Reset your password",
          `<p>A password reset was requested for <b>${user.email}</b>. The link is valid for one hour. If this wasn't you, you can safely ignore this message.</p>`,
          url,
          "Choose a new password",
        ),
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    emailVerificationTokenExpiresIn: 86_400, // 24 hours
    sendVerificationEmail: async ({ user, url }) => {
      await mailer().send({
        to: user.email,
        subject: "Verify your Margins email",
        text:
          `Welcome to Margins, ${user.name}.\n\nConfirm your email address (${user.email}) by opening:\n${url}\n\n` +
          `The link is valid for 24 hours.`,
        html: emailHtml(
          "Verify your email",
          `<p>Welcome, <b>${user.name}</b>. Confirm your address (${user.email}) to start your study library. The link is valid for 24 hours.</p>`,
          url,
          "Verify email",
        ),
      });
    },
  },
});
