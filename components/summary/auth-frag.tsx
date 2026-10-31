import SummaryNote, { NOTE_DATA } from "./note";

/*

A real fragment of this product's own interface (root marked data-ui), shown beside
every auth form: the Summarize result a student is studying toward.

*/

export default function AuthFrag({ caption }: { caption: string }) {
  return (
    <aside className="auth-frag" data-ui>
      <div className="panel" style={{ padding: 16 }}>
        <div className="frag-row">
          <span>
            <span className="frag-title" style={{ display: "block" }}>{NOTE_DATA.title}</span>
            <span className="frag-meta">{NOTE_DATA.meta}</span>
          </span>
          <span className="frag-meta">Summarized 21:14</span>
        </div>
        <SummaryNote />
        <p className="frag-info">{caption}</p>
      </div>
    </aside>
  );
}
