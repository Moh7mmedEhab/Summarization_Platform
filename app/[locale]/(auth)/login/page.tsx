"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import AuthFrame from "@/components/auth/frame";
import { authClient } from "@/lib/auth/client";
import { Link, useRouter } from "@/lib/i18n/navigation";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: authError } = await authClient.signIn.email({
      email,
      password,
      callbackURL: "/",
    });
    setBusy(false);
    if (authError) {
      const known = t.has(`errors.${authError.code}`);
      setError(known ? t(`errors.${authError.code}` as never) : t("genericError"));
      return;
    }
    router.replace("/");
  }

  return (
    <AuthFrame
      fragCaption={t("fragCaptionLogin")}
      links={t.rich("linksNew", {
        link: (chunks) => <Link href="/register">{chunks}</Link>,
      })}
    >
      <h1>{t("login.title")}</h1>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">{t("login.email")}</label>
          <input
            className="input"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder={t("login.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <div className="row-between">
            <label htmlFor="password">{t("login.password")}</label>
            <Link className="link-quiet" href="/forgot-password">
              {t("login.forgot")}
            </Link>
          </div>
          <input
            className="input"
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder={t("login.passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? <p className="criteria" role="alert">{error}</p> : null}
        <button className="btn primary lg" type="submit" disabled={busy}>
          {busy ? t("login.submitting") : t("login.submit")}
        </button>
      </form>
    </AuthFrame>
  );
}
