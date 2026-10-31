"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type {
  SummaryContentT,
  PointT,
  EmphasisT,
  SourceRefT,
} from "@/lib/ai/schema";
import {
  PenIcon,
  AudioIcon,
  WarnIcon,
  FlaskIcon,
  SigmaIcon,
  TableIcon,
  FlowIcon,
  ChartIcon,
  CopyIcon,
  RefreshIcon,
  EditIcon,
  DownloadIcon,
  CheckIcon,
} from "@/components/icons";
import DiagramFigure, { refLabel } from "./diagram-figure";
import ChartFigure from "./chart-figure";

/*
The summary viewer: the margin rail (kept/share ratio), the key points with
source references, lecturer emphasis pills, plus formulas, tables, diagrams,
charts, exam notes, warnings and the coverage ledger. Also: a light edit mode
(points' text), copy, print and regenerate.
*/

export type ViewerProps = {
  documentId: string;
  summaryId: string;
  content: SummaryContentT;
  keptPercent: number | null;
  sourceWords: number | null;
  summaryWords: number | null;
  hasAudio: boolean;
};

export default function SummaryViewer(props: ViewerProps) {
  const t = useTranslations("summary");
  const tCommon = useTranslations("common");
  const tLibrary = useTranslations("library");
  const [content, setContent] = useState(props.content);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [copied, setCopied] = useState(false);

  const { keptPercent, sourceWords, summaryWords } = props;
  const kept = keptPercent ?? (sourceWords && summaryWords ? Math.round((summaryWords / sourceWords) * 100) : null);

  async function copyNotes() {
    const text = contentToPlain(content, refLabel);
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function saveEdits() {
    setSaved("saving");
    const res = await fetch(`/api/summaries/${props.summaryId}`, {
      method: "PATCH",
      headers: { "content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setSaved(res.ok ? "ok" : "err");
    if (res.ok) {
      setEditing(false);
      setTimeout(() => setSaved("idle"), 2000);
    }
  }

  function regenerate() {
    fetch(`/api/documents/${props.documentId}/summarize`, {
      method: "POST",
      headers: { "content-Type": "application/json" },
      body: JSON.stringify({ language: content.language, style: "comprehensive" }),
    }).then(() => window.location.reload());
  }

  const editPoint = (si: number, pi: number, text: string) =>
    setContent((c) => {
      const sections = c.sections.map((s, i) =>
        i === si
          ? { ...s, points: s.points.map((p, j) => (j === pi ? { ...p, text } : p)) }
          : s,
      );
      return { ...c, sections };
    });

  return (
    <section className="result" aria-labelledby="summary-h">
      <div className="title-row" style={{ marginBottom: 12 }}>
        <h2 id="summary-h">{t("title")}</h2>
        <span className="actions">
          <button className="textaction" type="button" onClick={copyNotes}>
            <CopyIcon />
            {copied ? tCommon("copied") : t("actions.copy")}
          </button>
          <a className="textaction" href={`/api/documents/${props.documentId}/download`} onClick={undefined}>
            {t("actions.download")}
            <DownloadIcon />
          </a>
          <button className="textaction" type="button" onClick={() => setEditing((v) => !v)}>
            <EditIcon />
            {editing ? t("editing") : t("edit")}
          </button>
          <button className="btn" type="button" onClick={regenerate}>
            <RefreshIcon />
            {t("actions.regenerate")}
          </button>
        </span>
      </div>

      <div className="grid12">
        <div className="points margin">
          <div className="ratio" aria-label={t("youKept", { percent: kept ?? 0 })}>
            <div className="pair">
              <span className="lbl">{t("source")}</span>
              <span className="bar src">
                <i style={{ width: "100%" }} />
              </span>
              <span className="val num">{sourceWords ?? "—"} {tCommon("words", { count: sourceWords ?? 0 }).split(" ")[1] ?? "w"}</span>
            </div>
            <div className="pair">
              <span className="lbl">{t("summaryOf")}</span>
              <span className="bar">
                <i style={{ width: `${Math.max(2, kept ?? 0)}%` }} />
              </span>
              <span className="val num">
                {summaryWords ?? "—"}
                {sourceWords !== null && summaryWords !== null
                  ? ` · ${t("fewerWords", { count: Math.max(0, sourceWords - summaryWords) })}`
                  : ""}
              </span>
            </div>
          </div>

          {content.overview ? (
            <p className="overview frag-meta">{content.overview}</p>
          ) : null}

          {content.sections.map((section, si) => (
            <div key={si} className="summary-section">
              <h3 className="section-heading">
                {section.heading}
                {section.importance === "high" ? <span className="pill warn">{t("examNotes")}</span> : null}
              </h3>
              <ul className="keypoints">
                {section.points.map((p, pi) => (
                  <PointRow
                    key={pi}
                    point={p}
                    hasAudio={props.hasAudio}
                    emphasis={section.emphasis.filter((e) => sameTopic(e, p))}
                    editing={editing}
                    onEdit={(text) => editPoint(si, pi, text)}
                  />
                ))}
              </ul>
              {section.definitions.length > 0 ? (
                <dl className="definitions">
                  {section.definitions.map((d, i) => (
                    <div key={i}>
                      <dt>{d.term}</dt>
                      <dd>
                        {d.meaning} <span className="point-ref">{refLabel(d.refs)}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {section.examples.length > 0 ? (
                <ul className="examples">
                  {section.examples.map((ex, i) => (
                    <li key={i}>
                      <FlaskIcon className="pen" />
                      <span>
                        {ex.title ? <b>{ex.title} — </b> : null}
                        {ex.body} <span className="point-ref">{refLabel(ex.refs)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}

          {content.examNotes.length > 0 ? (
            <>
              <h3 className="section-heading">{t("examNotes")}</h3>
              <ul className="keypoints">
                {content.examNotes.map((n, i) => (
                  <li key={i}>
                    <PenIcon className="pen" />
                    <span>
                      {n.text} <span className="point-ref">{refLabel(n.refs)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {content.warnings.length > 0 ? (
            <ul className="keypoints warnings">
              {content.warnings.map((w, i) => (
                <li key={i}>
                  <WarnIcon className="pen" />
                  <span>
                    {w.text} <span className="point-ref">{refLabel(w.refs)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        < aside className="margin-side">
          {content.formulas.length > 0 ? (
            <div className="panel">
              <h3>
                <SigmaIcon /> {t("formulas")}
              </h3>
              {content.formulas.map((f, i) => (
                <div key={i} className="formula">
                  <code dir="ltr">{f.latex}</code>
                  <p>{f.explanation}</p>
                  {f.variables.length > 0 ? (
                    <ul className="vars">
                      {f.variables.map((v, j) => (
                        <li key={j}>
                          <b dir="ltr">{v.symbol}</b> = {v.meaning}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {f.refs.length > 0 ? <span className="point-ref">{refLabel(f.refs)}</span> : null}
                </div>
              ))}
            </div>
          ) : null}

          {content.tables.map((tb, i) => (
            <div className="panel" key={i}>
              <h3>
                <TableIcon /> {t("tables")}
              </h3>
              <p className="frag-meta">{tb.title}</p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {tb.headers.map((h, j) => (
                        <th key={j}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tb.rows.map((row, j) => (
                      <tr key={j}>
                        {row.map((cell, k) => (
                          <td key={k}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {content.diagrams.map((d, i) => (
            <div className="panel" key={i}>
              <h3>
                <FlowIcon /> {t("diagrams")}
              </h3>
              <DiagramFigure diagram={d} />
            </div>
          ))}

          {content.charts.map((c, i) => (
            <div className="panel" key={i}>
              <h3>
                <ChartIcon /> {t("charts")}
              </h3>
              <ChartFigure chart={c} />
            </div>
          ))}

          <div className="panel">
            <h3>
              <AudioIcon /> {t("coverage")}
            </h3>
            <p className="frag-meta">{t("coverageNote")}</p>
            {content.coverage.possibleGaps.length > 0 ? (
              <>
                <b className="t">{t("coverageGaps")}</b>
                <ul className="coverage-list">
                  {content.coverage.possibleGaps.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {content.coverage.unreadable.length > 0 ? (
              <>
                <b className="t">{t("coverageUnreadable")}</b>
                <ul className="coverage-list">
                  {content.coverage.unreadable.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {content.coverage.analyzed.length > 0 ? (
              <p className="frag-meta">
                {t("coverageAnalyzed")}: {content.coverage.analyzed.slice(0, 8).join(" · ")}
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      {saved === "saving" ? <p className="criteria">{tCommon("saving")}</p> : null}
      {saved === "ok" ? <p className="criteria">{tLibrary("status.summarized")}</p> : null}
      {saved === "err" ? <p className="criteria" role="alert">{tCommon("error")}</p> : null}
    </section>
  );
}

function sameTopic(e: EmphasisT, p: PointT): boolean {
  const a = e.topic.toLowerCase();
  const b = `${p.lead ?? ""} ${p.text}`.toLowerCase();
  return a.length > 4 && b.includes(a.slice(0, Math.min(12, a.length)));
}

function PointRow({
  point,
  emphasis,
  hasAudio,
  editing,
  onEdit,
}: {
  point: PointT;
  emphasis: EmphasisT[];
  hasAudio: boolean;
  editing: boolean;
  onEdit: (text: string) => void;
}) {
  const t = useTranslations("summary");
  const [value, setValue] = useState(point.text);
  const emphasized = emphasis.length > 0;

  return (
    <li className={emphasized ? "emphasized" : undefined}>
      <PenIcon className="pen" />
      <span>
        <b>{point.lead}</b>
        {editing ? (
          <input
            className="input"
            style={{ marginInlineStart: 6, padding: "2px 8px", fontSize: "inherit" }}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              onEdit(e.target.value);
            }}
          />
        ) : (
          <>
            {point.lead ? " " : ""}
            {point.text}
          </>
        )}{" "}
        <span className="point-ref">{refLabel(point.refs)}</span>
        {point.exam ? <span className="pill warn">{t("examNotes")}</span> : null}
        {emphasized ? <EmphasisCell emphasis={emphasis} hasAudio={hasAudio} /> : null}
      </span>
    </li>
  );
}

function EmphasisCell({ emphasis, hasAudio }: { emphasis: EmphasisT[]; hasAudio: boolean }) {
  const t = useTranslations("summary");
  return (
    <span className="emphasis-bundle">
      {emphasis.map((e, i) => (
        <span className="pill accent" key={i} title={e.reason}>
          <PenIcon className="pen" />
          {t("emphasis.label")}
          {hasAudio && e.timeStart !== undefined ? (
            <span className="num">
              {" "}
              · {t("emphasis.at", { time: stamp(e.timeStart, e.timeEnd ?? e.timeStart) })}
            </span>
          ) : null}
        </span>
      ))}
    </span>
  );
}

const stamp = (start: number, end: number): string => {
  const f = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return start === end ? f(start) : `${f(start)}–${f(end)}`;
};

/** Plain-text export used by the copy action. */
function contentToPlain(
  content: SummaryContentT,
  refLabelFn: (refs: SourceRefT[]) => string,
): string {
  const out: string[] = [content.title, "", content.overview, ""];
  for (const s of content.sections) {
    out.push(`## ${s.heading}`);
    for (const p of s.points) out.push(`- ${(p.lead ? `${p.lead} ` : "") + p.text} [${refLabelFn(p.refs)}]`);
    for (const d of s.definitions) out.push(`* ${d.term}: ${d.meaning} [${refLabelFn(d.refs)}]`);
    out.push("");
  }
  for (const f of content.formulas) out.push(`${f.latex}\n  ${f.explanation}`);
  for (const n of content.examNotes) out.push(`[exam] ${n.text}`);
  return out.join("\n");
}
