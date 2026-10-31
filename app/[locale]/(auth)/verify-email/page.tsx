"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import AuthFrame from "@/components/auth/frame";
import { authClient } from "@/lib/auth/client";
import { Link, useRouter } from "@/lib/i18n/navigation";

function VerifyInner() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"checking" | "validating" | "ok" | "inbox" | "failed">(
    token ? "validating" : "inbox",
  );
  const [resent, setResent] = useState<"idle" | "sent" | "failed">("idle");
  const email = useSearchParams().get("email") ?? "";

  useEffect(() => {
    if (!token || state !== "validating") return;
    authClient.verifyEmail(
      { query: { token } },
      {
        onSuccess: () => {
          setState("ok");
          // autoSignInAfterVerification gives a session; the workspace awaits.
          setTimeout(() => router.replace("/"), 1600);
        },
        onError: () => setState("failed"),
      },
    );
  }, [token, state, router]);

  async function resend() {
    if (!email) return;
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: `/${locale}/verify-email`,
    });
    setResent(error ? "failed" : "sent");
  }

  return (
    <AuthFrame
      fragCaption={t("fragCaptionVerify")}
      links={t.rich("linksStuck", { link: (chunks) => <Link href="/login">{chunks}</Link> })}
    >
      {state === "ok" ? (
        <>
          <h1>{t("verifyDone.title")}</h1>
          <p className="sub">{t("verifyDone.body")}</p>
          <button className="btn primary lg" type="button" onClick={() => router.replace("/")}>
            {t("verifyDone.go")}
          </button>
        </>
      ) : state === "checking" ? (
        <p className="sub">…</p>
      ) : state === "failed" ? (
        <>
          <h1>{t("verify.title")}</h1>
          <p className="sub">{t("reset.invalid")}</p>
          <Link className="link-quiet" href="/register">
            {t("register.submit")}
          </Link>
        </>
      ) : (
        <>
          <h1>{t("verify.title")}</h1>
          <p className="sub">
            {email ? (
              <>
                {t("verify.subA")} <b>{email}</b>
                {t("verify.subB")}
              </>
            ) : (
              t("verify.subGeneric")
            )}
          </p>
          {email ? (
            <>
              <button className="btn primary lg" type="button" onClick={resend}>
                {t("verify.resend")}
              </button>
              {resent === "sent" ? <p className="criteria">{t("verify.resent")}</p> : null}
              {resent === "failed" ? <p className="criteria">{t("verify.sendAgainFailed")}</p> : null}
            </>
          ) : (
            <Link className="btn primary lg" href="/login">
              {t("login.submit")}
            </Link>
          )}
          <p className="hint-cite">
            {t.rich("linksWrongAddress", { link: (chunks) => <Link href="/register">{chunks}</Link> })}
          </p>
        </>
      )}
    </AuthFrame>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyInner />
    </Suspense>
  );
}
