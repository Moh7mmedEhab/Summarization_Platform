"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";

/** Change password: revokes other sessions server-side on success. */
export default function SecurityPage() {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "ok" | "wrong" | "err" | "mismatch">("idle");

  const hasNumber = (s: string) => /\d/.test(s);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setState("mismatch");
      return;
    }
    setState("busy");
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      // Current (still valid) session kept; other devices are now signed out.
      setState("ok");
      setCurrent("");
      setNext("");
      setConfirm("");
      setTimeout(() => router.replace("/profile"), 1800);
    } else if (body?.error?.code === "invalid") {
      setState("wrong");
    } else {
      setState("err");
    }
  }

  const msg =
    state === "ok" ? t("security.done")
    : state === "wrong" ? t("security.wrongCurrent")
    : state === "mismatch" ? t("security.criteria")
    : state === "err" ? tCommon("error")
    : null;

  return (
    <>
      <div className="title-row">
        <div>
          <h1>{t("security.title")}</h1>
          <p className="sub">{t("security.sub")}</p>
        </div>
      </div>

      <section className="setsec" aria-labelledby="pw-h">
        <div className="lab">
          <h2 id="pw-h">{t("security.submit")}</h2>
          <p>{t("security.sessions")}</p>
        </div>
        <div className="panel">
          <form onSubmit={submit} className="settingsform">
            <div className="field">
              <label htmlFor="cur-pw">{t("security.currentPassword")}</label>
              <input
                className="input"
                id="cur-pw"
                type="password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="new-pw" aria-describedby="sec-criteria">
                {t("security.newPassword")}
              </label>
              <input
                className="input"
                id="new-pw"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                aria-describedby="sec-criteria"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              <p className="criteria" id="sec-criteria">
                {t("security.criteria")}
              </p>
            </div>
            <div className="field">
              <label htmlFor="new-pw2">{t("security.newPassword")}</label>
              <input
                className="input"
                id="new-pw2"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {msg ? <p className="criteria" role={state === "ok" ? "status" : "alert"}>{msg}</p> : null}
            <div>
              <button className="btn primary" type="submit" disabled={state === "busy"}>
                {t("security.submit")}
              </button>
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
