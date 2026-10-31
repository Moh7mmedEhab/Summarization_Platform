import path from "node:path";
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import { env } from "@/lib/env";

/**
 * Mailer abstraction.
 * - `dev` (default): writes each message as an .eml file into storage/mail-outbox/
 *   and logs it to the server console. No network email is sent — the app never
 *   claims a message was delivered when it was not.
 * - `smtp`: sends through EMAIL_SMTP_URL (e.g. smtps://user:password@host:465).
 */

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type MailResult =
  | { delivered: true }
  | { delivered: false; /** how the message actually landed, for honest UX */ outbox?: string };

export interface Mailer {
  readonly provider: string;
  send(message: MailMessage): Promise<MailResult>;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function emailBody(strings: TemplateStringsArray, ...values: string[]): string {
  let body = strings[0] ?? "";
  values.forEach((value, index) => {
    body += `${escapeHtml(value)}${strings[index + 1] ?? ""}`;
  });
  return body;
}

function eml(message: MailMessage, from: string): string {
  return [
    `From: ${from}`,
    `To: ${message.to}`,
    `Subject: ${message.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    message.html,
    ``,
    `----- plain text -----`,
    ``,
    message.text,
  ].join("\r\n");
}

class DevMailer implements Mailer {
  readonly provider = "dev";

  async send(message: MailMessage): Promise<MailResult> {
    const dir = path.join(env().STORAGE_DIR, "mail-outbox");
    await fs.mkdir(dir, { recursive: true });
    const name = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${
      message.to.replace(/[^a-z0-9._@-]/gi, "_")
    }.eml`;
    const file = path.join(dir, name);
    await fs.writeFile(file, eml(message, env().EMAIL_FROM), "utf-8");

    console.log(
      `[mailer:dev] Email was NOT sent (${this.provider} provider). Wrote ${path.relative(process.cwd(), file)}.`,
    );
    console.log(`[mailer:dev]   to: ${message.to}  subject: ${message.subject}`);
    for (const m of message.text.matchAll(/https?:\/\/\S+/g)) {
      console.log(`[mailer:dev]   link: ${m[0]}`);
    }
    return { delivered: false, outbox: path.relative(process.cwd(), file) };
  }
}

class SmtpMailer implements Mailer {
  readonly provider = "smtp";

  async send(message: MailMessage): Promise<MailResult> {
    const url = env().EMAIL_SMTP_URL;
    if (!url) throw new Error("EMAIL_SMTP_URL is not configured (EMAIL_PROVIDER=smtp)");
    const { createTransport } = await import("nodemailer");
    await createTransport(url).sendMail({
      from: env().EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    return { delivered: true };
  }
}

let instance: Mailer | null = null;

export function mailer(): Mailer {
  if (instance) return instance;
  instance = env().EMAIL_PROVIDER === "smtp" ? new SmtpMailer() : new DevMailer();
  return instance;
}

/** Small HTML shell so auth emails stay readable in the .eml preview. */
export function emailHtml(
  title: string,
  body: string,
  linkUrl?: string,
  linkText?: string,
): string {
  const link = linkUrl
    ? `<p style="margin:24px 0"><a href="${escapeHtml(linkUrl)}" style="display:inline-block;padding:10px 18px;border-radius:6px;background:#b8336a;color:#fff;text-decoration:none">${escapeHtml(linkText ?? "Open link")}</a></p>`
    : "";
  return `<div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
  <p style="font-size:15px;font-weight:700;margin:0 0 16px">Margins</p>
  <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>
  <div style="font-size:14px;line-height:1.6">${body}</div>
  ${link}
</div>`;
}
