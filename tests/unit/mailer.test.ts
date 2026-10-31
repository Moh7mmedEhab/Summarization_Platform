import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

/*
Mailer tests. No network access: the SMTP transport is mocked, the dev outbox
writes into a temporary directory. Covers provider selection, honest dev
delivery semantics, e-mail construction helpers, and escaping.
*/

const envStore = vi.hoisted(() => ({
  values: {
    EMAIL_PROVIDER: "dev",
    EMAIL_SMTP_URL: "",
    EMAIL_FROM: "Margins <no-reply@margins.local>",
    STORAGE_DIR: "storage",
  } as Record<string, string>,
}));

const transportCalls = vi.hoisted(() => ({
  createTransport: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: () => envStore.values,
}));

vi.mock("nodemailer", () => ({
  createTransport: (...args: unknown[]) => transportCalls.createTransport(...args),
}));

/** Fresh mailer instance per test (the module caches a singleton). */
async function freshMailer() {
  vi.resetModules();
  return (await import("@/lib/email/mailer")).mailer();
}

const message = {
  to: "student@example.com",
  subject: "Verify your Margins email",
  text: "Open https://margins.example/verify?token=x",
  html: "<p>Open <b>the link</b></p>",
};

describe("mailer provider selection", () => {
  it('selects the dev outbox when EMAIL_PROVIDER is "dev"', async () => {
    envStore.values.EMAIL_PROVIDER = "dev";
    const m = await freshMailer();
    expect(m.provider).toBe("dev");
  });

  it('selects SMTP when EMAIL_PROVIDER is "smtp"', async () => {
    envStore.values.EMAIL_PROVIDER = "smtp";
    const m = await freshMailer();
    expect(m.provider).toBe("smtp");
  });

  it("treats anything unknown as dev (honest default)", async () => {
    envStore.values.EMAIL_PROVIDER = "carrier-pigeon";
    const m = await freshMailer();
    expect(m.provider).toBe("dev");
  });
});

describe("dev mailer (outbox)", () => {
  let storageDir = "";

  beforeEach(async () => {
    storageDir = await mkdtempBubble();
    envStore.values.STORAGE_DIR = storageDir;
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (storageDir) await rm(storageDir, { force: true, recursive: true }).catch(() => undefined);
  });

  it("writes an honest .eml and reports NOT delivered", async () => {
    const m = await freshMailer();
    const result = await m.send(message);

    expect(result.delivered).toBe(false);
    if (!result.delivered && result.outbox) {
      /* the UX may surface the outbox path instead of pretending delivery */
      expect(result.outbox).toContain("mail-outbox");
    }

    const dir = path.join(storageDir, "mail-outbox");
    const files = await readdir(dir);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain("student@example.com");

    const raw = await readFile(path.join(dir, files[0]), "utf-8");
    expect(raw).toContain("From: Margins <no-reply@margins.local>");
    expect(raw).toContain(`To: ${message.to}`);
    expect(raw).toContain(`Subject: ${message.subject}`);
    expect(raw).toContain("Content-Type: text/html; charset=utf-8");
    expect(raw).toContain(message.html);
    expect(raw).toContain(message.text);
  });
});

describe("smtp mailer (network delivery is mocked)", () => {
  beforeEach(() => {
    transportCalls.createTransport.mockReset();
  });

  it("sends the message fields through the configured URL", async () => {
    const sendMail = vi.fn().mockResolvedValue(undefined);
    transportCalls.createTransport.mockReturnValue({ sendMail });
    envStore.values.EMAIL_PROVIDER = "smtp";
    envStore.values.EMAIL_SMTP_URL =
      "smtps://user%40example.com:app%20password@smtp.example.com:465";

    const m = await freshMailer();
    const result = await m.send(message);

    expect(result.delivered).toBe(true);
    expect(transportCalls.createTransport).toHaveBeenCalledWith(envStore.values.EMAIL_SMTP_URL);
    expect(sendMail).toHaveBeenCalledWith({
      from: envStore.values.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  });

  it("fails loudly when the URL is missing", async () => {
    envStore.values.EMAIL_PROVIDER = "smtp";
    envStore.values.EMAIL_SMTP_URL = "";

    const m = await freshMailer();
    await expect(m.send(message)).rejects.toThrow(/EMAIL_SMTP_URL is not configured/);
    expect(transportCalls.createTransport).not.toHaveBeenCalled();
  });

  it("surfaces transport errors instead of pretending success", async () => {
    transportCalls.createTransport.mockReturnValue({
      sendMail: vi.fn().mockRejectedValue(new Error("535 authentication failed")),
    });
    envStore.values.EMAIL_PROVIDER = "smtp";
    envStore.values.EMAIL_SMTP_URL = "smtps://user@smtp.example.com:465";

    const m = await freshMailer();
    await expect(m.send(message)).rejects.toThrow("535 authentication failed");
  });
});

describe("email construction helpers", () => {
  it("emailBody escapes interpolated values", async () => {
    const { emailBody } = await import("@/lib/email/mailer");
    const out = emailBody`Hello ${'<img src=x onerror="alert(1)">'}, welcome`;
    expect(out).toBe("Hello &lt;img src=x onerror=&quot;alert(1)&quot;&gt;, welcome");
  });

  it("emailHtml escapes the title and the link URL", async () => {
    const { emailHtml } = await import("@/lib/email/mailer");
    const html = emailHtml(
      '<script>alert(1)</script>',
      "<b>body stays</b>",
      'https://margins.example/x?a=1&b="<y>"',
      "Open link",
    );
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("<b>body stays</b>");
    expect(html).toContain('href="https://margins.example/x?a=1&amp;b=&quot;&lt;y&gt;&quot;"');
    expect(html).toContain('style="display:inline-block;padding:10px 18px;border-radius:6px;background:#b8336a');
  });

  it("emailHtml omits the CTA when no link is given", async () => {
    const { emailHtml } = await import("@/lib/email/mailer");
    expect(emailHtml("Title", "<p>body</p>")).not.toContain("<a href");
  });
});

/** Unique, gitignored location under node_modules so tests never touch real /storage. */
async function mkdtempBubble(): Promise<string> {
  return `node_modules/.mailer-test/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
