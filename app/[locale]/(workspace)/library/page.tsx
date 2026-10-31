"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { relTime } from "@/lib/ai/reltime";
import {
  DocIcon,
  TextIcon,
  ImageIcon,
  AudioIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "@/components/icons";
import type { LibraryItem } from "@/features/documents/service";

/*
The library over real records: search, kind filter chips with computed counts,
kept% rail per row, rename/delete/download actions, pagination. Sample data
and hardcoded dates are gone.
*/

type Api = {
  ok: boolean;
  items: LibraryItem[];
  total: number;
  page: number;
  pages: number;
};

type Filter = "all" | "pdf" | "docx" | "text" | "image_set" | "audio";

const slotIcon = {
  pdf: <DocIcon />,
  docx: <DocIcon />,
  text: <TextIcon />,
  image_set: <ImageIcon />,
  audio: <AudioIcon />,
} as const;

export default function LibraryPage() {
  const t = useTranslations("library");
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");
  const router = useRouter();

  const [data, setData] = useState<Api | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (query: string, kind: Filter, pageNum: number) => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (kind !== "all") params.set("kind", kind);
      params.set("page", String(pageNum));
      try {
        const res = await fetch(`/api/documents?${params}`, { cache: "no-store" });
        const body = await res.json();
        if (body.ok) setData(body);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(q, filter, page);
  }, [load, filter, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSearch = (value: string) => {
    setQ(value);
    setLoading(true);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(value, filter, 1), 250);
  };

  const rename = async (id: string) => {
    const title = editTitle.trim();
    setEditing(null);
    if (!title || title.length === 0) return;
    setLoading(true);
    await fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    load(q, filter, page);
  };

  const destroy = async (id: string) => {
    if (!window.confirm(tCommon("confirmDelete"))) return;
    setLoading(true);
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    load(q, filter, page);
  };

  const summarize = async (id: string) => {
    setLoading(true);
    const res = await fetch(`/api/documents/${id}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "en", style: "comprehensive" }),
    });
    const body = await res.json();
    if (body.ok) router.push(`/library/${id}`);
    setLoading(false);
  };

  const counts: Record<Filter, number> = data
    ? {
        all: data.total,
        pdf: data.items.filter((i) => i.inputType === "pdf").length,
        docx: data.items.filter((i) => i.inputType === "docx").length,
        text: data.items.filter((i) => i.inputType === "text").length,
        image_set: data.items.filter((i) => i.inputType === "image_set").length,
        audio: data.items.filter((i) => i.inputType === "audio").length,
      }
    : { all: 0, pdf: 0, docx: 0, text: 0, image_set: 0, audio: 0 };

  return (
    <>
      <div className="title-row">
        <div>
          <h1>{t("title")}</h1>
          <p className="sub num">
            {data ? t("sub", { total: data.total, documents: counts.pdf + counts.docx, texts: counts.text, images: counts.image_set, recordings: counts.audio }) : tCommon("loading")}
          </p>
        </div>
        <div className="actions">
          <div className="search">
            <SearchIcon />
            <input
              className="input"
              aria-label={t("searchLabel")}
              placeholder={t("searchPlaceholder")}
              value={q}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
          <Link className="btn primary" href="/">
            <PlusIcon />
            {t("add")}
          </Link>
        </div>
      </div>

      <div className="chips" role="group" aria-label={t("filters")}>
        <button className="chip" aria-pressed={filter === "all"} onClick={() => { setFilter("all"); setPage(1); setLoading(true); }}>
          {t("filterAll")} <b className="num">{counts.all}</b>
        </button>
        {(["pdf", "text", "image_set", "audio"] as const).map((k) => (
          <button key={k} className="chip" aria-pressed={filter === k} onClick={() => { setFilter(k); setPage(1); setLoading(true); }}>
            {t(`kind.${k}`)} <b className="num">{counts[k]}</b>
          </button>
        ))}
      </div>

      <div className="panel" style={{ marginTop: "var(--gap)" }}>
        {loading && !data ? (
          <p className="sub">{tCommon("loading")}</p>
        ) : data && data.items.length === 0 ? (
          <div style={{ padding: "28px 8px", textAlign: "center" }}>
            <b>{t("empty.title")}</b>
            <p className="sub" style={{ marginTop: 6 }}>{q || filter !== "all" ? t("noMatch") : t("empty.body")}</p>
          </div>
        ) : (
          <ul className="items">
            {data?.items.map((item) => (
              <li className="item" key={item.id}>
                <span className="body">
                  <b>
                    {slotIcon[item.inputType]}
                    {editing === item.id ? (
                      <input
                        className="input"
                        defaultValue={item.title}
                        style={{ height: 30, padding: "2px 8px", fontSize: "inherit" }}
                        autoFocus
                        onBlur={(e) => rename(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") rename(item.id);
                          if (e.key === "Escape") setEditing(null);
                        }}
                      />
                    ) : (
                      <Link href={`/library/${item.id}`} className="t">
                        {item.title}
                      </Link>
                    )}
                  </b>
                  <span className="meta num">
                    {t(`kind.${item.inputType}`)} · {t("assetCount", { count: item.assetCount })}
                    {item.status === "summarized" && item.summaryPoints > 0
                      ? ` · ${t("keyPoints", { count: item.summaryPoints })}`
                      : ""}
                    {item.keptPercent !== null
                      ? <span className="kept-s phone-only num" style={{ display: "none" }}> · {t("kept", { percent: item.keptPercent })}</span>
                      : ""}
                  </span>
                </span>
                <span className="plot" aria-label={item.keptPercent !== null ? t("kept", { percent: item.keptPercent }) : undefined}>
                  {item.keptPercent !== null ? (
                    <>
                      <span className="bar-lg"><i style={{ width: `${item.keptPercent}%` }} /></span>
                      <span className="val num">{t("kept", { percent: item.keptPercent })}</span>
                    </>
                  ) : (
                    <span className="dash-wrap"><span className="dash">—</span></span>
                  )}
                </span>
                {item.status !== "summarized" && item.status !== "processing" ? (
                  <span className="action">
                    <button className="textaction" type="button" onClick={() => summarize(item.id)}>
                      {t("actions.summarize")}
                    </button>
                  </span>
                ) : null}
                <span className="action" style={{ display: "flex", gap: 2 }}>
                  <button
                    className="textaction"
                    type="button"
                    title={tCommon("rename")}
                    aria-label={tCommon("rename")}
                    onClick={() => {
                      setEditing(item.id);
                      setEditTitle(item.title);
                    }}
                  >
                    {tCommon("rename")}
                  </button>
                  <button
                    className="textaction"
                    type="button"
                    aria-label={tCommon("delete")}
                    title={tCommon("delete")}
                    onClick={() => destroy(item.id)}
                  >
                    <TrashIcon />
                  </button>
                </span>
                <span className="date">{relTime(item.createdAt, tNav("summarize"))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data && data.pages > 1 ? (
        <div className="title-row" style={{ justifyContent: "space-between", marginTop: "var(--gap)" }}>
          <button className="btn" type="button" disabled={data.page <= 1} onClick={() => { setPage((p) => p - 1); setLoading(true); }}>
            {t("prev")}
          </button>
          <span className="sub num">{t("pagination", { page: data.page, pages: data.pages })}</span>
          <button className="btn" type="button" disabled={data.page >= data.pages} onClick={() => { setPage((p) => p + 1); setLoading(true); }}>
            {t("next")}
          </button>
        </div>
      ) : null}

      <div className="panel newstrip">
        <div>
          <h2 style={{ fontSize: "var(--fs-section)", fontWeight: 600 }}>{t("newstrip.title")}</h2>
          <p className="substrip">{t("newstrip.body")}</p>
        </div>
        <Link className="btn" href="/">
          {t("newstrip.action")}
        </Link>
      </div>
    </>
  );
}
