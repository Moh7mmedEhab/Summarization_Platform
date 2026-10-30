import AppShell from "../app-shell";
import { items, countBy, kindLabel, type ItemKind } from "@/lib/data";
import { DocIcon, TextIcon, ImageIcon, PlusIcon, SaveIcon } from "@/lib/icons";

/*

Screen question: "What is in my library?"
Counts are computed from lib/data.ts, never typed: documents + texts + images = total.
Every row carries the share its summary keeps (the margin rail's signature). Rows with
no summary show a dash; the one document that needs work carries the visible action.
Images are kept but not summarized, so they carry no key points and no action.

*/

const slotIcon = { document: <DocIcon />, text: <TextIcon />, image: <ImageIcon /> };
const KINDS: ItemKind[] = ["document", "text", "image"];

export default function SavePage() {
  const total = items.length;
  return (
    <AppShell screen="save">
      <div className="title-row">
        <div>
          <h1>Library</h1>
          <p className="sub num">
            {total} items — {countBy("document")} documents, {countBy("text")} texts,{" "}
            {countBy("image")} images.
          </p>
        </div>
        <div className="actions">
          <div className="search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" width={14} height={14} aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.6-3.6" />
            </svg>
            <input className="input" aria-label="Search your library" placeholder="Search" />
          </div>
          <button className="btn primary">
            <PlusIcon />
            Add
          </button>
        </div>
      </div>

      <div className="chips" role="group" aria-label="Filter by kind">
        <button className="chip" aria-pressed="true">
          All <b className="num">{total}</b>
        </button>
        {KINDS.map((k) => (
          <button key={k} className="chip" aria-pressed="false">
            {kindLabel[k]} <b className="num">{countBy(k)}</b>
          </button>
        ))}
      </div>

      <div className="panel" style={{ marginTop: "var(--gap)" }}>
        <ul className="items">
          {items.map((item) => (
            <li className="item" key={item.id}>
              <span className="body">
                <b>
                  {slotIcon[item.kind]}
                  <a href={`#item-${item.id}`} className="t">
                    {item.title}
                  </a>
                </b>
                <span className="meta num">
                  {item.ext} · {item.size}
                  {item.points !== null ? ` · ${item.points} key points` : ""}
                  <span className="kept-s phone-only num" style={{ display: "none" }}>
                    {item.kept !== null ? ` · ${item.kept}% kept` : ""}
                  </span>
                </span>
              </span>
              <span className="plot" aria-label={item.kept !== null ? `${item.kept}% of the source kept` : undefined}>
                {item.kept !== null ? (
                  <>
                    <span className="bar-lg"><i style={{ width: `${item.kept}%` }} /></span>
                    <span className="val num">{item.kept}% kept</span>
                  </>
                ) : (
                  <span className="dash-wrap"><span className="dash">—</span></span>
                )}
              </span>
              {item.points === null && item.kind === "document" ? (
                <span className="action">
                  <button className="textaction" type="button">
                    Summarize
                  </button>
                </span>
              ) : null}
              <span className="date">{item.saved}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel newstrip">
        <div>
          <h2 style={{ fontSize: "var(--fs-section)", fontWeight: 600 }}>Summarize something new</h2>
          <p className="substrip">Drop a file or paste text; the summary lands ready to save.</p>
        </div>
        <a className="btn" href="/summarize">
          <SaveIcon />
          Summarize
        </a>
      </div>
    </AppShell>
  );
}
