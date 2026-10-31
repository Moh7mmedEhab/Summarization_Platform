import type { DiagramT } from "@/lib/ai/schema";

/*
Safe diagram rendering: a restricted node/edge graph (validated by the summary
contract) laid out in a lane/depth model and drawn as static SVG. No generated
HTML, no scripts — the shapes are ours, only labels come from the data.
*/

const BOX = { w: 118, h: 44, rx: 8 };
const PAD = 28;
const GAP_X = 72;
const GAP_Y = 66;

export default function DiagramFigure({ diagram }: { diagram: DiagramT }) {
  const nodes = [...diagram.nodes]
    .sort((a, b) =>
      diagram.kind === "hierarchy"
        ? (a.level ?? 0) - (b.level ?? 1) || (a.order ?? 0) - (b.order ?? 0)
        : (a.order ?? 0) - (b.order ?? 0),
    )
    .map((n, i) => {
      if (diagram.kind === "hierarchy") {
        const perRow = Math.min(3, diagram.nodes.length);
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        const rowCount = diagram.nodes.length - row * perRow;
        const offset = (perRow - Math.min(perRow, rowCount)) / 2;
        return {
          ...n,
          x: PAD + col * (BOX.w + GAP_X) + offset * (BOX.w / 2),
          y: PAD + row * (BOX.h + GAP_Y),
          row,
        };
      }
      // flow / cycle: one lane
      const cols = Math.min(3, diagram.nodes.length);
      const rows = Math.ceil(diagram.nodes.length / 3);
      const row = Math.floor(i / 3);
      const col = i % 3;
      return {
        ...n,
        x: PAD + col * (BOX.w + GAP_X),
        y: PAD + row * (BOX.h + GAP_Y),
        row,
      };
    });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const width = Math.max(...nodes.map((n) => n.x + BOX.w)) + PAD;
  const height = Math.max(...nodes.map((n) => n.y + BOX.h)) + PAD;

  return (
    <figure className="diagram" dir="ltr">
      <figcaption>
        {diagram.title}
        {diagram.refs.length > 0 ? <span className="frag-meta num"> {refLabel(diagram.refs)}</span> : null}
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={diagram.title}>
        {diagram.edges.map((e, i) => {
          const from = byId.get(e.from);
          const to = byId.get(e.to);
          if (!from || !to) return null;
          // edge from box edge to box edge
          const goingDown = to.y > from.y;
          const x1 = goingDown ? from.x + BOX.w / 2 : from.x + BOX.w;
          const y1 = goingDown ? from.y + BOX.h : from.y + BOX.h / 2;
          const x2 = goingDown ? to.x + BOX.w / 2 : to.x;
          const y2 = goingDown ? to.y : to.y + BOX.h / 2;
          const midY = (y1 + y2) / 2;
          const path = goingDown
            ? `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
            : `M ${x1} ${y1} L ${x2 - 8} ${y2}`;
          return (
            <g key={i}>
              <path
                d={path}
                fill="none"
                stroke="var(--control)"
                strokeWidth={1.5}
                markerEnd="url(#margin-arrow)"
              />
              {e.label ? (
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 - 6}
                  className="diagram-edge-label"
                  textAnchor="middle"
                >
                  {e.label}
                </text>
              ) : null}
            </g>
          );
        })}
        <defs>
          <marker id="margin-arrow" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--control)" />
          </marker>
        </defs>
        {nodes.map((n) => (
          <g key={n.id}>
            <rect
              x={n.x}
              y={n.y}
              width={BOX.w}
              height={BOX.h}
              rx={BOX.rx}
              fill="var(--surface)"
              stroke="var(--accent-track)"
            />
            {textLines(n.label, 18).map((line, li) => (
              <text
                key={li}
                x={n.x + BOX.w / 2}
                y={n.y + BOX.h / 2 + (li - (lines(n.label) - 1) / 2) * 14 + 4}
                textAnchor="middle"
                className="diagram-label"
              >
                {line}
              </text>
            ))}
          </g>
        ))}
      </svg>
    </figure>
  );
}

const lines = (s: string): number => Math.ceil(s.length / 18);
const textLines = (s: string, max: number): string[] => {
  const words = s.split(/\s+/);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) {
      out.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) out.push(cur);
  return out.slice(0, 3);
};

/** Human label for a reference list, shared by diagrams and charts. */
export function refLabel(
  refs: Array<{ kind: string; start?: number | null; end?: number | null; label?: string | null }>,
): string {
  const r = refs[0];
  if (!r) return "";
  switch (r.kind) {
    case "page":
      return r.end ? `pages ${r.start}–${r.end}` : `page ${r.start}`;
    case "paragraph":
      return `¶${r.start ?? "?"}`;
    case "image":
      return `image ${r.start ?? "?"}`;
    case "timestamp": {
      const fmt = (s?: number | null) =>
        s != null
          ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
          : "";
      const time = r.end ? `${fmt(r.start)}–${fmt(r.end)}` : `${fmt(r.start)}`;
      return r.label ? `${r.label} · ${time}` : time;
    }
    default:
      return r.label ?? "";
  }
}
