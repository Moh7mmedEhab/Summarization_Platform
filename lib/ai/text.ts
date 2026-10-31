import type { SummaryContentT } from "@/lib/ai/schema";

export function countWords(text: string): number {
  const m = text.trim().match(/[\p{L}\p{N}'’_-]+/gu);
  return m ? m.length : 0;
}

export function countSummaryWords(content: SummaryContentT): number {
  const strings = [
    content.title,
    content.overview,
    ...content.sections.flatMap((section) => [
      section.heading,
      ...section.points.flatMap((point) => [point.lead ?? "", point.text]),
      ...section.definitions.flatMap((definition) => [definition.term, definition.meaning]),
      ...section.examples.flatMap((example) => [example.title ?? "", example.body]),
      ...section.emphasis.flatMap((item) => [item.topic, item.reason, item.quote ?? "", item.conflict ?? ""]),
    ]),
    ...content.formulas.flatMap((formula) => [
      formula.latex,
      formula.explanation,
      ...formula.variables.flatMap((variable) => [variable.symbol, variable.meaning]),
    ]),
    ...content.tables.flatMap((table) => [table.title, ...table.headers, ...table.rows.flat()]),
    ...content.diagrams.flatMap((diagram) => [
      diagram.title,
      ...diagram.nodes.map((node) => node.label),
      ...diagram.edges.map((edge) => edge.label ?? ""),
    ]),
    ...content.charts.flatMap((chart) => [
      chart.title,
      chart.unit ?? "",
      ...chart.points.map((point) => point.label),
    ]),
    ...content.examNotes.map((note) => note.text),
    ...content.warnings.map((warning) => warning.text),
  ];
  return strings.reduce((total, text) => total + countWords(text), 0);
}

export function truncateWords(text: string, max: number): string {
  const words = text.split(/\s+/);
  return words.length <= max ? text : words.slice(0, max).join(" ") + "…";
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
