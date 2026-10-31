import { z } from "zod";

/**
 * The summary contract. The Gemini pipeline must produce JSON that validates
 * against this; malformed responses get one repair pass before the job fails.
 * Everything the viewer renders (points, definitions, emphasis, tables,
 * diagrams, charts) is grounded in these structures — the frontend never
 * invents source references or lecturer quotes.
 */

export const SOURCE_REF_KINDS = [
  "page", // PDF page; label rendered from #pages when end is set
  "paragraph",
  "image",
  "timestamp", // recording position, seconds
  "text", // general reference when no page/timestamp is reliable
] as const;

export const SourceRef = z.object({
  kind: z.enum(SOURCE_REF_KINDS),
  start: z.coerce.number().nullish(), // page/paragraph/image number, or seconds for timestamps
  end: z.coerce.number().nullish(),
  label: z.string().max(160).nullish(), // exact source label or brief verbatim context; never fabricated
});

export const Importance = z.enum(["high", "normal"]);

export const Point = z.object({
  lead: z.string().max(200).nullish(), // short bold lead-in, e.g. "Three stages."
  text: z.string().max(2000),
  refs: z.array(SourceRef).max(6).default([]),
  exam: z.boolean().default(false), // flagged as exam-relevant (source/lecturer statement)
});

export const Definition = z.object({
  term: z.string().max(300),
  meaning: z.string().max(2000),
  refs: z.array(SourceRef).max(6).default([]),
});

export const ExampleItem = z.object({
  title: z.string().max(300).optional(),
  body: z.string().max(4000),
  refs: z.array(SourceRef).max(6).default([]),
});

export const Emphasis = z.object({
  topic: z.string().max(300),
  reason: z.string().max(600), // why the lecturer emphasized it
  quote: z.string().max(600).optional(), // short supporting quote from the recording
  timeStart: z.coerce.number().optional(), // seconds into the recording
  timeEnd: z.coerce.number().optional(),
  ref: SourceRef.optional(), // the related written-material position, when one exists
  audioOnly: z.boolean().default(false), // appears in the recording but not the source document
  conflict: z.string().max(1200).optional(), // audio and written material disagree → show both
  confidence: z.coerce.number().min(0).max(1).default(0.5),
});

export const Section = z.object({
  heading: z.string().max(300),
  importance: Importance.default("normal"),
  points: z.array(Point).max(30).default([]),
  definitions: z.array(Definition).max(30).default([]),
  examples: z.array(ExampleItem).max(20).default([]),
  emphasis: z.array(Emphasis).max(20).default([]),
  refs: z.array(SourceRef).max(6).default([]),
});

export const Formula = z.object({
  latex: z.string().max(600),
  explanation: z.string().max(2000),
  variables: z.array(z.object({ symbol: z.string().max(40), meaning: z.string().max(300) })).max(12).default([]),
  refs: z.array(SourceRef).max(6).default([]),
});

export const TableBlock = z.object({
  title: z.string().max(300),
  headers: z.array(z.string().max(120)).min(1).max(10),
  rows: z.array(z.array(z.string().max(400)).min(1).max(10)).max(40),
  refs: z.array(SourceRef).max(6).default([]),
});

/** Safe diagram: a restricted node/edge graph rendered to SVG. No HTML/JS. */
export const Diagram = z.object({
  kind: z.enum(["flow", "cycle", "hierarchy"]),
  title: z.string().max(200),
  nodes: z.array(z.object({
    id: z.string().max(40),
    label: z.string().max(160),
    order: z.coerce.number().nullish(), // for flow: left→right lane
    level: z.coerce.number().nullish(), // for hierarchy: depth
  })).min(2).max(12),
  edges: z.array(z.object({
    from: z.string().max(40),
    to: z.string().max(40),
    label: z.string().max(80).nullish(),
  })).max(16),
  refs: z.array(SourceRef).max(6).default([]),
});

/** Chart from numbers that exist in the source. Never invented values. */
export const Chart = z.object({
  kind: z.enum(["bar", "line"]),
  title: z.string().max(200),
  unit: z.string().max(40).nullish(),
  points: z.array(z.object({
    label: z.string().max(80),
    value: z.coerce.number(),
  })).min(2).max(16),
  refs: z.array(SourceRef).max(6).default([]),
});

export const Coverage = z.object({
  analyzed: z.array(z.string().max(200)).default([]),
  unreadable: z.array(z.string().max(300)).default([]),
  possibleGaps: z.array(z.string().max(600)).default([]),
});

export const SummaryContent = z.object({
  title: z.string().max(300),
  // Tolerant by design: some model passes echo "english"/"arabic"; the pipeline
  // overwrites this with the requested language right after parsing anyway.
  language: z.enum(["en", "ar"]).catch("en"),
  overview: z.string().max(4000),
  sections: z.array(Section).min(1).max(40),
  formulas: z.array(Formula).max(20).default([]),
  tables: z.array(TableBlock).max(15).default([]),
  diagrams: z.array(Diagram).max(10).default([]),
  charts: z.array(Chart).max(10).default([]),
  examNotes: z.array(z.object({
    text: z.string().max(1200),
    refs: z.array(SourceRef).max(6).default([]),
  })).max(20).default([]),
  warnings: z.array(z.object({
    text: z.string().max(1200),
    refs: z.array(SourceRef).max(6).default([]),
  })).max(20).default([]),
  coverage: Coverage,
});

export type SummaryContentT = z.infer<typeof SummaryContent>;
export type SourceRefT = z.infer<typeof SourceRef>;
export type PointT = z.infer<typeof Point>;
export type EmphasisT = z.infer<typeof Emphasis>;
export type SectionT = z.infer<typeof Section>;
export type DiagramT = z.infer<typeof Diagram>;
export type ChartT = z.infer<typeof Chart>;

export const SUMMARY_STYLES = [
  "comprehensive",
  "key_points",
  "paragraph",
  "exam_prep",
] as const;
export type SummaryStyleT = (typeof SUMMARY_STYLES)[number];
