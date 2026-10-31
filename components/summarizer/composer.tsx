"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { PenIcon, TextIcon, DocIcon, ImageIcon, AudioIcon, PlusIcon } from "@/components/icons";
import { JobTracker } from "@/components/summarizer/job-tracker";

/*
The composer: drag & drop or pick material files (PDF/DOCX/TXT/images), an
optional lecture recording, pasted text, summary style + language, then start.
Validations mirror the server (size limits by kind, 12-file cap) for fast
feedback; the server re-checks everything on its own.
*/

const STYLES = ["comprehensive", "key_points", "paragraph", "exam_prep"] as const;
const SOURCE_LIMIT_MB = 50;
const AUDIO_LIMIT_MB = 50;
const MAX_FILES = 12;

const AUDIO_EXT = /\.(mp3|wav|m4a|ogg|webm)$/i;

type Picked = {
  id: number;
  file: File;
  audio: boolean;
};

type Phase =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "job"; jobId: string; documentId: string }
  | { kind: "failed"; message: string };

export default function Composer() {
  const t = useTranslations("composer");
  const tProgress = useTranslations("progress");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [style, setStyle] = useState<(typeof STYLES)[number]>("comprehensive");
  const [language, setLanguage] = useState<"en" | "ar">(locale === "ar" ? "ar" : "en");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const nextId = useRef(1);
  const fileInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);

  const words = useMemo(() => text.trim().match(/[\p{L}\p{N}'’_-]+/gu)?.length ?? 0, [text]);
  const hasAudio = picked.some((p) => p.audio);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      setNotice(null);
      const incoming = Array.from(files);
      setPicked((cur) => {
        if (cur.length + incoming.length > MAX_FILES) {
          setNotice(t("files.overLimit"));
          return cur;
        }
        const additions = incoming.map((file): Picked => {
          const audio = AUDIO_EXT.test(file.name) || file.type.startsWith("audio/");
          if (audio && file.size > AUDIO_LIMIT_MB * 1024 * 1024) {
            setNotice(t("files.tooLarge", { name: file.name, limit: AUDIO_LIMIT_MB }));
          }
          if (!audio && file.size > SOURCE_LIMIT_MB * 1024 * 1024) {
            setNotice(t("files.tooLarge", { name: file.name, limit: SOURCE_LIMIT_MB }));
          }
          return { id: nextId.current++, file, audio };
        });
        return [...cur, ...additions];
      });
    },
    [t],
  );

  const removePicked = (id: number) =>
    setPicked((cur) => cur.filter((p) => p.id !== id));

  async function createDocument(): Promise<string> {
    const hasText = text.trim().length > 0;
    if (picked.length === 0 && !hasText) {
      throw new Error(t("empty"));
    }
    const docTitle =
      title.trim() ||
      picked[0]?.file.name.replace(/\.[^.]+$/, "") ||
      t("titlePlaceholder");
    let documentId: string;

    if (picked.length > 0) {
      const form = new FormData();
      form.set("title", docTitle);
      if (hasText) form.set("text", text);
      for (const p of picked) form.append("files", p.file, p.file.name);
      const res = await fetch("/api/documents/upload", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok || body.ok === false) {
        throw new Error(body?.error?.message ?? tCommon("error"));
      }
      documentId = body.documentId;
      if (body.rejected?.length) {
        // Honest reporting: the server refused specific files (type/size).
        const r = body.rejected[0];
        setNotice(`${r.name}: ${r.reason}`);
      }
    } else {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: docTitle, text }),
      });
      const body = await res.json();
      if (!res.ok || body.ok === false) {
        throw new Error(body?.error?.message ?? tCommon("error"));
      }
      documentId = body.documentId;
    }
    return documentId;
  }

  async function startJob(documentId: string): Promise<string> {
    const res = await fetch(`/api/documents/${documentId}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, style }),
    });
    const body = await res.json();
    if (!res.ok || body.ok === false) {
      throw new Error(body?.error?.message ?? tCommon("error"));
    }
    return body.jobId;
  }

  async function summarize(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    setPhase({ kind: "saving" });
    try {
      const documentId = await createDocument();
      const jobId = await startJob(documentId);
      setPhase({ kind: "job", jobId, documentId });
    } catch (err) {
      setPhase({ kind: "failed", message: err instanceof Error ? err.message : tCommon("error") });
    }
  }

  async function saveDraft(e: React.MouseEvent) {
    setNotice(null);
    setPhase({ kind: "saving" });
    try {
      const documentId = await createDocument();
      setPhase({ kind: "idle" });
      setNotice(t("saveDraft.done"));
      router.push(`/library/${documentId}`);
    } catch (err) {
      setPhase({ kind: "failed", message: err instanceof Error ? err.message : tCommon("error") });
    }
  }

  const busy = phase.kind === "saving" || phase.kind === "job";
  const dropped = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  return (
    <form className="composer" onSubmit={summarize}>
      <div className="mode-row">
        <span className="fieldlabel">{t("styleLabel")}</span>
        <div className="segmented" role="group" aria-label={t("styleLabel")}>
          {STYLES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={style === s}
              disabled={busy}
              onClick={() => setStyle(s)}
            >
              {t(`style.${s}`)}
            </button>
          ))}
        </div>
        <span className="fieldlabel" style={{ marginLeft: "auto" }}>
          {t("languageLabel")}
        </span>
        <select
          className="input"
          style={{ width: "auto", height: 36 }}
          value={language}
          disabled={busy}
          onChange={(e) => setLanguage(e.target.value === "ar" ? "ar" : "en")}
          aria-label={t("languageLabel")}
        >
          <option value="en">English</option>
          <option value="ar">العربية</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="doc-title">{t("titleField")}</label>
        <input
          className="input"
          id="doc-title"
          name="title"
          maxLength={300}
          placeholder={t("titlePlaceholder")}
          value={title}
          disabled={busy}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div
        className={dragging ? "dropzone active" : "dropzone"}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={dropped}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" width={20} height={20} aria-hidden>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M12 15V9M9.5 11.5 12 9l2.5 2.5" />
        </svg>
        <span>{dragging ? t("dropzoneActive") : t("dropzone")}</span>
        <span className="dropzone-btns">
          <button type="button" className="btn" onClick={() => fileInput.current?.click()} disabled={busy}>
            {t("files.add")}
          </button>
          <button type="button" className="btn" onClick={() => audioInput.current?.click()} disabled={busy}>
            <AudioIcon />
            {t("files.audio")}
          </button>
        </span>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={audioInput}
          type="file"
          hidden
          accept=".mp3,.wav,.m4a,.ogg,.webm,audio/*"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {picked.length > 0 ? (
        <ul className="picked" role="list">
          {picked.map((p) => (
            <li key={p.id}>
              <span className="slot">{p.audio ? <AudioIcon /> : p.file.type.startsWith("image/") ? <ImageIcon /> : <DocIcon />}</span>
              <b>{p.file.name}</b>
              <span className="meta num">
                {(p.file.size / 1024 / 1024).toFixed(1)} MB{p.audio ? ` · ${t("files.audio")}` : ""}
              </span>
              <button
                type="button"
                className="textaction"
                aria-label={t("files.removeLabel", { name: p.file.name })}
                onClick={() => removePicked(p.id)}
                disabled={busy}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {notice ? <p className="criteria" role="status">{notice}</p> : null}
      {picked.length > 0 && hasAudio ? <p className="criteria">{t("files.audioAttached")}</p> : null}

      <textarea
        className="input"
        rows={12}
        required={picked.length === 0}
        aria-label={t("textArea")}
        placeholder={t("textArea")}
        value={text}
        disabled={busy}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="foot">
        <span className="count num">{t("count", { words })}</span>
        <button className="btn" type="button" onClick={saveDraft} disabled={busy || (!text.trim() && picked.length === 0)}>
          {t("saveDraft.label")}
        </button>
        <button className="btn primary lg" type="submit" disabled={busy || (!text.trim() && picked.length === 0)}>
          {busy ? t("submitting") : t("submit")}
          <PlusIcon />
        </button>
      </div>

      {phase.kind === "job" ? (
        <JobTracker
          jobId={phase.jobId}
          documentId={phase.documentId}
          onDone={(documentId) => router.push(`/library/${documentId}`)}
          onFailed={(msg) => setPhase({ kind: "failed", message: msg })}
        />
      ) : null}
      {phase.kind === "failed" ? (
        <div className="panel" role="alert">
          <p className="criteria">
            <b>{tProgress("failed")}</b> {phase.message}
          </p>
        </div>
      ) : null}
    </form>
  );
}
