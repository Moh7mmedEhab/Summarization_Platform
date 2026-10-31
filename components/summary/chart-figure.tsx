import type { ChartT } from "@/lib/ai/schema";
import { refLabel } from "./diagram-figure";

/*
SVG bar/line chart drawn only from values the model validated against the
source (the contract forbids invented numbers). Pure SVG, RTL-safe numbers.
*/

const W = 420;
const H = 220;
const PAD_L = 44;
const PAD_B = 34;
const PAD_T = 14;
const PAD_R = 14;

export default function ChartFigure({ chart }: { chart: ChartT }) {
  const { points, title, unit } = chart;
  const max = Math.max(...points.map((p) => Math.abs(p.value)), 0.000001);
  const ticks = 4;
  const step = points.length > 1 ? (W - PAD_L - PAD_R) / (points.length - 1) : 0;
  const y = (v: number) => H - PAD_B - (Math.abs(v) / max) * (H - PAD_B - PAD_T);
  const x = (i: number) => (points.length > 1 ? PAD_L + i * step : PAD_L + (W - PAD_L - PAD_R) / 2);

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.value)}`).join(" ");
  const areaPath = `${linePath} L ${x(points.length - 1)} ${H - PAD_B} L ${x(0)} ${H - PAD_B} Z`;

  return (
    <figure className="chart" dir="ltr">
      <figcaption>
        {title}
        {unit ? <span className="frag-meta num"> ({unit})</span> : null}
        {chart.refs.length > 0 ? <span className="frag-meta num"> · {refLabel(chart.refs)}</span> : null}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const v = (max / ticks) * i;
          return (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="var(--rule)" />
              <text x={PAD_L - 6} y={y(v) + 3} textAnchor="end" className="chart-tick num">
                {fmt(v)}
              </text>
            </g>
          );
        })}
        {chart.kind === "bar"
          ? points.map((p, i) => {
              const bw = Math.min(36, Math.max(14, 220 / points.length));
              return (
                <g key={i}>
                  <rect
                    x={x(i) - bw / 2}
                    y={y(p.value)}
                    width={bw}
                    height={H - PAD_B - y(p.value)}
                    rx={3}
                    fill="var(--accent)"
                    opacity={0.9}
                  />
                  <text x={x(i)} y={y(p.value) - 5} textAnchor="middle" className="chart-tick num">
                    {fmt(p.value)}
                  </text>
                </g>
              );
            })
          : null}
        {chart.kind === "line" ? (
          <>
            <path d={areaPath} fill="var(--accent)" opacity={0.12} />
            <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} />
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={x(i)} cy={y(p.value)} r={3.5} fill="var(--accent)" />
                <text x={x(i)} y={y(p.value) - 8} textAnchor="middle" className="chart-tick num">
                  {fmt(p.value)}
                </text>
              </g>
            ))}
          </>
        ) : null}
        {points.map((p, i) => (
          <text key={i} x={x(i)} y={H - PAD_B + 16} textAnchor="middle" className="chart-label">
            {chart.kind === "line" && points.length > 6 && i % 2 === 1 ? "" : p.label.slice(0, 12)}
          </text>
        ))}
        {points.map((p, i) =>
          chart.kind === "line" && points.length > 6 && i % 2 === 1 ? null : null,
        )}
      </svg>
    </figure>
  );
}

const fmt = (v: number): string =>
  Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 100) / 100);
