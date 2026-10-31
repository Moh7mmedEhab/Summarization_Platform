"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { relTime } from "@/lib/ai/reltime";

/*
Profile: account facts, honest verification badge, editable name, usage counts,
and a quick language switch. Security (password) lives at /profile/security.
*/

export type ProfileData = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  counts: { documents: number; summaries: number };
};

export default function ProfileClient({
  profile,
  locale,
}: {
  profile: ProfileData;
  locale: string;
}) {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const [name, setName] = useState(profile.name);
  const [nameState, setNameState] = useState<"idle" | "saving" | "ok" | "err">("idle");

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.trim() === profile.name) return;
    setNameState("saving");
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setNameState(res.ok ? "ok" : "err");
    if (res.ok) setTimeout(() => setNameState("idle"), 2000);
  }

  return (
    <>
      <div className="title-row">
        <div>
          <h1>{t("title")}</h1>
        </div>
      </div>

      <section className="setsec" aria-labelledby="account-h">
        <div className="lab">
          <h2 id="account-h">{t("sectionAccount.title")}</h2>
          <p>{t("sectionAccount.memberSince", { date: relTime(profile.createdAt, locale) })}</p>
          <p className={profile.emailVerified ? "criteria" : "criteria"}>
            {profile.emailVerified ? t("sectionAccount.verified") : t("sectionAccount.unverified")}
          </p>
        </div>
        <div className="panel">
          <form onSubmit={saveName} className="settingsform">
            <div className="field">
              <label htmlFor="pf-name">{t("sectionAccount.name")}</label>
              <input
                className="input"
                id="pf-name"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="pf-email">{t("sectionAccount.email")}</label>
              <input className="input" id="pf-email" value={profile.email} readOnly disabled />
            </div>
            <div className="foot" style={{ justifyContent: "flex-start" }}>
              {nameState === "saving" ? <span className="frag-meta">{tCommon("saving")}</span> : null}
              {nameState === "ok" ? <span className="frag-meta">{t("nameSaved")}</span> : null}
              {nameState === "err" ? <span className="frag-meta">{tCommon("error")}</span> : null}
              <button className="btn primary" type="submit" disabled={nameState === "saving"}>
                {tCommon("save")}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="setsec" aria-labelledby="usage-h">
        <div className="lab">
          <h2 id="usage-h">{t("sectionUsage.title")}</h2>
        </div>
        <div className="panel">
          <div className="kpis">
            <div className="kpi">
              <span className="kpi-label num">{t("sectionUsage.documents", { count: profile.counts.documents })}</span>
              <span className="kpi-value num">{profile.counts.documents}</span>
            </div>
            <div className="kpi">
              <span className="kpi-label num">{t("sectionUsage.summaries", { count: profile.counts.summaries })}</span>
              <span className="kpi-value num">{profile.counts.summaries}</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
