import { PenIcon } from "@/lib/icons";

/*

A real fragment of this product's own interface (root marked data-ui), shown beside
every auth form: the Summarize result a student is studying toward. Sample data.

*/

const points = [
  { lead: "Three stages.", rest: " Glycolysis, the Krebs cycle, then the electron transport chain.", ref: "¶1–2" },
  { lead: "Glycolysis nets 2 ATP,", rest: " splitting glucose into two pyruvates.", ref: "¶3" },
  { lead: "ATP synthase", rest: " is driven by the proton gradient.", ref: "¶6" },
];

export default function AuthFrag({ caption }: { caption: string }) {
  return (
    <aside className="auth-frag" data-ui>
      <div className="panel" style={{ padding: 16 }}>
        <div className="frag-row">
          <span>
            <span className="frag-title" style={{ display: "block" }}>Cellular respiration (Lecture 4)</span>
            <span className="frag-meta">Pasted text · 156 words · 5 key points</span>
          </span>
          <span className="frag-meta">Summarized 21:14</span>
        </div>
        <div className="margin">
          <div className="frag-row" style={{ marginBottom: 6 }}>
            <span className="frag-meta" style={{ color: "var(--accent-ink)" }}>You kept 34% of the source.</span>
            <span className="frag-meta">Summary · 53 words</span>
          </div>
          <div className="ratio" style={{ marginTop: 0 }}>
            <div className="pair">
              <span className="lbl">Source</span>
              <span className="bar src"><i style={{ width: "100%" }} /></span>
              <span className="val">156</span>
            </div>
            <div className="pair">
              <span className="lbl">Summary</span>
              <span className="bar"><i style={{ width: "34%" }} /></span>
              <span className="val">53</span>
            </div>
          </div>
          <ul className="keypoints">
            {points.map((p) => (
              <li key={p.ref}>
                <PenIcon className="pen" />
                <span>
                  <b>{p.lead}</b>
                  {p.rest} <span className="point-ref">{p.ref}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="frag-info">{caption}</p>
      </div>
    </aside>
  );
}
