import AppShell from "../app-shell";
import { PenIcon, TextIcon, SaveIcon, DocIcon } from "@/lib/icons";
import { items } from "@/lib/data";

const recent = items[0];

/*

Screen question: "What does this text say, in brief?"
Face: the raspberry pen on the margin panel's key points (written in notes 29 Oct).
Signature element: the margin rail — the summary's weight against the source's.
Sample data: one pasted excerpt (156 words) summarizing to 5 points / 53 displayed words.

*/

const source = `Cellular respiration is the process by which cells break down glucose to release energy as ATP. It happens in three stages: glycolysis in the cytoplasm, the Krebs cycle, then the electron transport chain.
Glycolysis splits one glucose molecule into two pyruvate molecules and nets two ATP. The pyruvate moves into the mitochondrion, where the Krebs cycle strips off high-energy electrons carried by NADH and FADH2. Those electrons power the electron transport chain, which pumps protons across the inner membrane. The proton gradient then drives ATP synthase, producing the bulk of the cell's ATP.
Oxygen is the final electron acceptor; without it, the chain backs up and the cell falls back on fermentation, which yields far less ATP per glucose. Aerobic respiration produces roughly 30 to 32 ATP molecules from one glucose, compared with two from fermentation. That difference is why the Krebs cycle and the electron transport chain carry most of the exam's weight this week.`;

const SOURCE_WORDS = 156; // count of the pasted excerpt above
const SUMMARY_WORDS = 53; // count of the five key points below
const SOURCE_REF = Math.round(SOURCE_WORDS * (1 - SUMMARY_WORDS / SOURCE_WORDS)); // words dropped
const KEPT_PCT = Math.round((SUMMARY_WORDS / SOURCE_WORDS) * 100); // 34

const points: Array<{ lead: string; rest: string; ref: string; exam?: boolean }> = [
  { lead: "Three stages.", rest: " Glycolysis, the Krebs cycle, then the electron transport chain.", ref: "¶1–2" },
  { lead: "Glycolysis nets 2 ATP,", rest: " splitting glucose into two pyruvates.", ref: "¶3" },
  { lead: "NADH carries energy", rest: " from the Krebs cycle to the transport chain, which pumps protons.", ref: "¶4–6" },
  { lead: "ATP synthase", rest: " is driven by the proton gradient.", ref: "¶6", exam: true },
  { lead: "Oxygen is required;", rest: " without it, fermentation yields 2 ATP per glucose.", ref: "¶7–8", exam: true },
];

export default function SummarizePage() {
  return (
    <AppShell screen="summarize">
      <div className="title-row">
        <div>
          <h1>Summarize</h1>
          <p className="sub">Drop a file or paste text; the summary lands below.</p>
        </div>
      </div>

      <form className="composer" action="#summarizing">
        <div className="mode-row">
          <span className="fieldlabel">Summary style</span>
          <div className="segmented" role="group" aria-label="Summary style">
            <button type="button" aria-pressed="true">Key points</button>
            <button type="button" aria-pressed="false">Paragraph</button>
            <button type="button" aria-pressed="false">Exam notes</button>
          </div>
        </div>
        <div className="dropzone">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" width={20} height={20} aria-hidden>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M12 15V9M9.5 11.5 12 9l2.5 2.5" />
          </svg>
          <span>Drop a PDF or DOCX here, or paste below.</span>
        </div>
        <textarea
          className="input"
          rows={12}
          aria-label="Text to summarize"
          defaultValue={source}
        />
        <div className="foot">
          <span className="count num">{SOURCE_WORDS} words</span>
          <button className="btn primary lg" type="submit">
            Summarize
          </button>
        </div>
      </form>

      <section className="result" aria-labelledby="summary-h">
        <div className="title-row" style={{ marginBottom: 12 }}>
          <h2 id="summary-h">Summary</h2>
          <span className="stamp num">Summarized 21:14</span>
        </div>
        <div className="grid12">
          <div className="points margin">
            <div className="ratio" aria-label="How much of the source you keep">
              <div className="pair">
                <span className="lbl">Source</span>
                <span className="bar src"><i style={{ width: "100%" }} /></span>
                <span className="val num">{SOURCE_WORDS} words</span>
              </div>
              <div className="pair">
                <span className="lbl">Summary</span>
                <span className="bar"><i style={{ width: `${KEPT_PCT}%` }} /></span>
                <span className="val num">
                  {SUMMARY_WORDS} words · {SOURCE_REF} fewer
                </span>
              </div>
            </div>
            <ul className="keypoints">
              {points.map((p) => (
                <li key={p.ref}>
                  <PenIcon className="pen" />
                  <span>
                    <b>{p.lead}</b>
                    {p.rest}{" "}
                    <span className="point-ref">{p.ref}</span>
                    {p.exam ? <span className="pill warn">Exam</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="savedas">
            <div className="panel">
              <h3>Save to library</h3>
              <div className="preview">
                <span className="slot"><TextIcon /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    aria-label="Item title"
                    defaultValue="Cellular respiration (Lecture 4)"
                    style={{
                      width: "100%",
                      border: 0,
                      background: "none",
                      font: "13px/18px var(--font)",
                      fontWeight: 600,
                      color: "var(--text)",
                      padding: 0,
                    }}
                  />
                  <span className="num">
                    Pasted text · {SOURCE_WORDS} words · 5 key points
                  </span>
                </div>
              </div>
              <div className="actions">
                <button className="btn" type="button">
                  <SaveIcon />
                  Save to library
                </button>
                <button className="btn ghost" type="button">
                  Copy summary
                </button>
              </div>
              <p className="hint">
                Source and summary are saved together, and both show under Save.
              </p>
              <div className="recent">
                <p className="reclabel">Recently kept</p>
                <div className="item">
                  <span className="body">
                    <b>
                      <DocIcon />
                      <a href={`#item-${recent.id}`} className="t">{recent.title}</a>
                    </b>
                    <span className="meta num">
                      {recent.ext} · {recent.size} · {recent.points} key points
                    </span>
                  </span>
                  <span className="date">{recent.saved}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
