"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Polls /api/jobs/[jobId] for progress; renders the in-progress rail in the
 * composer's result slot and hands control to the summary page on success.
 */
export function JobTracker({
  jobId,
  documentId,
  onDone,
  onFailed,
}: {
  jobId: string;
  documentId: string;
  onDone: (documentId: string) => void;
  onFailed: (message: string) => void;
}) {
  const t = useTranslations("progress");
  const tCommon = useTranslations("common");
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<string | null>(null);
  const finished = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (finished.current) return;
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        const body = await res.json();
        if (!res.ok || body.ok === false) throw new Error("poll failed");
        const job = body.job as {
          status: string;
          progress: number;
          stage: string | null;
          error: string | null;
        };
        setProgress(job.progress);
        if (job.stage) setStage(job.stage);
        if (job.status === "succeeded") {
          finished.current = true;
          onDone(documentId);
          return;
        }
        if (job.status === "failed" || job.status === "canceled") {
          finished.current = true;
          onFailed(job.error ?? tCommon("error"));
          return;
        }
      } catch {
        // transient network glitch; keep polling
      }
      timer = setTimeout(poll, 2_500);
    };
    poll();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const knownStage =
    stage && t.has(`stage.${stage}`) ? t(`stage.${stage}` as never) : t("stage.preparing");

  async function cancel() {
    await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
    finished.current = true;
    onFailed(t("canceled"));
  }

  return (
    <section className="result" aria-live="polite">
      <div className="title-row" style={{ marginBottom: 12 }}>
        <h2>{t("title")}</h2>
        <button className="textaction" type="button" onClick={cancel}>
          {t("cancel")}
        </button>
      </div>
      <div className="panel">
        <p className="criteria">{knownStage}</p>
        <span className="progress" aria-label={knownStage}>
          <i style={{ width: `${progress}%` }} />
        </span>
        <p className="frag-meta num" style={{ marginTop: 8 }}>
          {progress}%
        </p>
      </div>
    </section>
  );
}
