"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import AuthFrame from "@/components/auth/frame";
import { authClient } from "@/lib/auth/client";
import { Link, useRouter } from "@/lib/i18n/navigation";

const hasNumber = (s: string) => /\d/.test(s);

export default function RegisterPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t("register.mismatch"));
      return;
    }
    setBusy(true);
    const { error: authError } = await authClient.signUp.email(
      {
        name,
        email,
        password,
        callbackURL: `/${locale}/verify-email`,
      },
      {
        onSuccess: () => router.replace("/verify-email"),
      },
    );
    setBusy(false);
    if (authError) {
      const known = t.has(`errors.${authError.code}`);
      setError(known ? t(`errors.${authError.code}` as never) : t("genericError"));
    }
  }

  const valid =
    name.trim().length > 0 && /\S+@\S+\.\S+/.test(email) && password.length >= 8 && hasNumber(password);

  return (
    <AuthFrame
      fragCaption={t("fragCaptionRegister")}
      links={t.rich("linksHave", { link: (chunks) => <Link href="/login">{chunks}</Link> })}
    >
      <h1>{t("register.title")}</h1>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="name">{t("register.name")}</label>
          <input
            className="input"
            id="name"
            name="name"
            autoComplete="name"
            required
            placeholder={t("register.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="email">{t("register.email")}</label>
          <input
            className="input"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder={t("register.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password" aria-describedby="pw-criteria">
            {t("register.password")}
          </label>
          <input
            className="input"
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            aria-describedby="pw-criteria"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="criteria" id="pw-criteria">
            {t("register.criteria")}
          </p>
        </div>
        <div className="field">
          <label htmlFor="confirm">{t("register.confirm")}</label>
          <input
            className="input"
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error ? <p className="criteria" role="alert">{error}</p> : null}
        <button className="btn primary lg" type="submit" disabled={busy || !valid}>
          {busy ? t("register.submitting") : t("register.submit")}
        </button>
      </form>
    </AuthFrame>
  );
}
