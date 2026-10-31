"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import AuthFrame from "@/components/auth/frame";
import { authClient } from "@/lib/auth/client";
import { Link } from "@/lib/i18n/navigation";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // Always resolves to the same honest message (no account enumeration).
    await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setBusy(false);
    setSent(true);
  }

  return (
    <AuthFrame
      fragCaption={t("fragCaptionForgot")}
      links={t.rich("linksRemembered", { link: (chunks) => <Link href="/login">{chunks}</Link> })}
    >
      <h1>{t("forgot.title")}</h1>
      {sent ? (
        <>
          <p className="sub">{t("forgot.sent")}</p>
          <p className="info-note">{t("forgot.note")}</p>
        </>
      ) : (
        <form onSubmit={submit}>
          <p className="sub">{t("forgot.sub")}</p>
          <div className="field">
            <label htmlFor="email">{t("forgot.email")}</label>
            <input
              className="input"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder={t("forgot.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button className="btn primary lg" type="submit" disabled={busy}>
            {t("forgot.submit")}
          </button>
        </form>
      )}
    </AuthFrame>
  );
}
