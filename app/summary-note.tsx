import { PenIcon } from "@/lib/icons";

/*

The margin rail as a reusable fragment (sample data, reconciled with app/summarize/page.tsx:
156-word source kept at 34%): the ratio pair and the pen-marked key points. Used by the
auth screens' product fragment and the settings screen's live preview.

*/

export const NOTE_DATA = {
  title: "Cellular respiration (Lecture 4)",
  meta: "Pasted text · 156 words · 5 key points",
  source: 156,
  summary: 53,
  kept: 34,
};

const points = [
  { lead: "Three stages.", rest: " Glycolysis, the Krebs cycle, then the electron transport chain.", ref: "¶1–2" },
  { lead: "Glycolysis nets 2 ATP,", rest: " splitting glucose into two pyruvates.", ref: "¶3" },
  { lead: "NADH carries energy", rest: " from the Krebs cycle to the transport chain, which pumps protons.", ref: "¶4–6" },
  { lead: "ATP synthase", rest: " is driven by the proton gradient.", ref: "¶6", exam: true },
  { lead: "Oxygen is required;", rest: " without it, fermentation yields 2 ATP per glucose.", ref: "¶7–8", exam: true },
];

export default function SummaryNote() {
  const { source, summary, kept } = NOTE_DATA;
  return (
    <div className="margin">
      <div className="frag-row" style={{ marginBottom: 6 }}>
        <span className="frag-meta" style={{ color: "var(--accent-ink)" }}>
          You kept {kept}% of the source.
        </span>
        <span className="frag-meta num">Summary · {summary} words</span>
      </div>
      <div className="ratio" style={{ marginTop: 0 }}>
        <div className="pair">
          <span className="lbl">Source</span>
          <span className="bar src"><i style={{ width: "100%" }} /></span>
          <span className="val">{source}</span>
        </div>
        <div className="pair">
          <span className="lbl">Summary</span>
          <span className="bar"><i style={{ width: `${kept}%` }} /></span>
          <span className="val">{summary}</span>
        </div>
      </div>
      <ul className="keypoints">
        {points.map((p) => (
          <li key={p.ref}>
            <PenIcon className="pen" />
            <span>
              <b>{p.lead}</b>
              {p.rest} <span className="point-ref">{p.ref}</span>
              {p.exam ? <span className="pill warn">Exam</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
