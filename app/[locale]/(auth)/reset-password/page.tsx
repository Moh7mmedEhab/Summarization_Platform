"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import AuthFrame from "@/components/auth/frame";
import { authClient } from "@/lib/auth/client";
import { Link, useRouter } from "@/lib/i18n/navigation";

const hasNumber = (s: string) => /\d/.test(s);

function ResetInner() {
  const t = useTranslations("auth");
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t("reset.mismatch"));
      return;
    }
    setBusy(true);
    const { error: authError } = await authClient.resetPassword(
      { newPassword: password },
      {
        onError: (ctx) => {
          setBusy(false);
          if (ctx.error.code === "INVALID_TOKEN" || ctx.error.status === 400) {
            setError(t("reset.invalid"));
          } else if (ctx.error.code === "PASSWORD_TOO_SHORT" || ctx.error.code === "WEAK_PASSWORD") {
            setError(t("reset.criteria"));
          } else {
            setError(t("genericError"));
          }
        },
        onSuccess: () => {
          setBusy(false);
          setDone(true);
          setTimeout(() => router.replace("/login"), 2000);
        },
      },
    );
    void authError;
  }

  if (!token) {
    return (
      <AuthFrame
        fragCaption={t("fragCaptionReset")}
        links={t.rich("linksDone", { link: (chunks) => <Link href="/login">{chunks}</Link> })}
      >
        <h1>{t("reset.title")}</h1>
        <p className="sub">{t("reset.invalid")}</p>
        <Link className="btn primary lg" href="/forgot-password">
          {t("forgot.submit")}
        </Link>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      fragCaption={t("fragCaptionReset")}
      links={t.rich("linksDone", { link: (chunks) => <Link href="/login">{chunks}</Link> })}
    >
      <h1>{t("reset.title")}</h1>
      {done ? (
        <p className="sub">{t("reset.done")}</p>
      ) : (
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="new-password" aria-describedby="pw-criteria">
              {t("reset.new")}
            </label>
            <input
              className="input"
              id="new-password"
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
              {t("reset.criteria")}
            </p>
          </div>
          <div className="field">
            <label htmlFor="confirm">{t("reset.confirm")}</label>
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
          <button className="btn primary lg" type="submit" disabled={busy}>
            {t("reset.submit")}
          </button>
        </form>
      )}
    </AuthFrame>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetInner />
    </Suspense>
  );
}
