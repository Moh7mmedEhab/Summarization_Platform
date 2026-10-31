/**
 * tests/unit/schema.test.ts
 *
 * Unit tests for lib/ai/schema.ts (Zod AI payload contract)
 * Covers: valid payload acceptance, default application, and invalid payload rejection
 */

import { describe, it, expect } from "vitest";
import {
  SourceRef,
  Point,
  Definition,
  ExampleItem,
  Emphasis,
  Section,
  Diagram,
  Chart,
  SummaryContent,
  Coverage,
} from "@/lib/ai/schema";

// ---------------------------------------------------------------------------
// Helper: build a minimal valid SummaryContent payload
// ---------------------------------------------------------------------------
function minimalSummaryContent() {
  return {
    title: "Test Summary",
    language: "en" as const,
    overview: "A brief overview.",
    sections: [
      {
        heading: "Introduction",
        points: [{ text: "Key point one" }],
      },
    ],
    coverage: {
      analyzed: [],
      unreadable: [],
      possibleGaps: [],
    },
  };
}

// ---------------------------------------------------------------------------
// SourceRef
// ---------------------------------------------------------------------------
describe("SourceRef", () => {
  it("valid kind: page → parses", () => {
    const result = SourceRef.parse({ kind: "page", start: 1, end: 5 });
    expect(result.kind).toBe("page");
    expect(result.start).toBe(1);
  });

  it("valid kind: timestamp with numeric start/end → parses", () => {
    const result = SourceRef.parse({ kind: "timestamp", start: 60, end: 120 });
    expect(result.kind).toBe("timestamp");
    expect(result.start).toBe(60);
    expect(result.end).toBe(120);
  });

  it("valid kind: text → parses", () => {
    const result = SourceRef.parse({ kind: "text" });
    expect(result.kind).toBe("text");
  });

  it("invalid kind: 'video' → throws", () => {
    expect(() => SourceRef.parse({ kind: "video" })).toThrow();
  });

  it("label max 160 chars → accepts exactly 160", () => {
    const result = SourceRef.parse({ kind: "page", label: "x".repeat(160) });
    expect(result.label).toHaveLength(160);
  });

  it("label > 160 chars → throws", () => {
    expect(() => SourceRef.parse({ kind: "page", label: "x".repeat(161) })).toThrow();
  });

  it("coerces string start to number", () => {
    const result = SourceRef.parse({ kind: "page", start: "42" });
    expect(result.start).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// Point
// ---------------------------------------------------------------------------
describe("Point", () => {
  it("minimal valid Point (text only) → parses", () => {
    const result = Point.parse({ text: "This is a key point." });
    expect(result.text).toBe("This is a key point.");
  });

  it("default: refs → []", () => {
    const result = Point.parse({ text: "Some text" });
    expect(result.refs).toEqual([]);
  });

  it("default: exam → false", () => {
    const result = Point.parse({ text: "Some text" });
    expect(result.exam).toBe(false);
  });

  it("Point with exam: true and source refs → parses", () => {
    const result = Point.parse({
      text: "Important exam point",
      exam: true,
      refs: [{ kind: "page", start: 10 }],
    });
    expect(result.exam).toBe(true);
    expect(result.refs).toHaveLength(1);
  });

  it("text exceeding 2000 chars → throws", () => {
    expect(() => Point.parse({ text: "a".repeat(2001) })).toThrow();
  });

  it("text exactly 2000 chars → parses", () => {
    const result = Point.parse({ text: "a".repeat(2000) });
    expect(result.text).toHaveLength(2000);
  });

  it("lead max 200 chars → accepts exactly 200", () => {
    const result = Point.parse({ text: "point", lead: "L".repeat(200) });
    expect(result.lead).toHaveLength(200);
  });

  it("lead > 200 chars → throws", () => {
    expect(() => Point.parse({ text: "point", lead: "L".repeat(201) })).toThrow();
  });

  it("refs with more than 6 items → throws", () => {
    const refs = Array(7).fill({ kind: "page", start: 1 });
    expect(() => Point.parse({ text: "test", refs })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Definition
// ---------------------------------------------------------------------------
describe("Definition", () => {
  it("valid definition → parses", () => {
    const result = Definition.parse({ term: "Photosynthesis", meaning: "Process by which plants..." });
    expect(result.term).toBe("Photosynthesis");
    expect(result.refs).toEqual([]);
  });

  it("missing term → throws", () => {
    expect(() => Definition.parse({ meaning: "Something" })).toThrow();
  });

  it("missing meaning → throws", () => {
    expect(() => Definition.parse({ term: "Term" })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Emphasis
// ---------------------------------------------------------------------------
describe("Emphasis", () => {
  it("valid Emphasis → parses", () => {
    const result = Emphasis.parse({
      topic: "Mitosis",
      reason: "Lecturer spent 15 minutes on it",
    });
    expect(result.topic).toBe("Mitosis");
    expect(result.confidence).toBe(0.5); // default
    expect(result.audioOnly).toBe(false); // default
  });

  it("reason exceeding 600 chars → throws", () => {
    expect(() => Emphasis.parse({ topic: "Topic", reason: "r".repeat(601) })).toThrow();
  });

  it("reason exactly 600 chars → parses", () => {
    const result = Emphasis.parse({ topic: "T", reason: "r".repeat(600) });
    expect(result.reason).toHaveLength(600);
  });

  it("confidence coerces from string", () => {
    const result = Emphasis.parse({ topic: "T", reason: "R", confidence: "0.8" });
    expect(result.confidence).toBe(0.8);
  });

  it("confidence < 0 → throws", () => {
    expect(() => Emphasis.parse({ topic: "T", reason: "R", confidence: -0.1 })).toThrow();
  });

  it("confidence > 1 → throws", () => {
    expect(() => Emphasis.parse({ topic: "T", reason: "R", confidence: 1.1 })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Diagram
// ---------------------------------------------------------------------------
describe("Diagram", () => {
  const validDiagram = {
    kind: "flow" as const,
    title: "Test Diagram",
    nodes: [
      { id: "a", label: "Node A" },
      { id: "b", label: "Node B" },
    ],
    edges: [{ from: "a", to: "b" }],
  };

  it("valid diagram with 2+ nodes → parses", () => {
    const result = Diagram.parse(validDiagram);
    expect(result.nodes).toHaveLength(2);
    expect(result.refs).toEqual([]);
  });

  it("diagram with fewer than 2 nodes → throws", () => {
    expect(() => Diagram.parse({ ...validDiagram, nodes: [{ id: "a", label: "Only" }] })).toThrow();
  });

  it("diagram with more than 16 edges → throws", () => {
    const edges = Array(17).fill({ from: "a", to: "b" });
    expect(() => Diagram.parse({ ...validDiagram, edges })).toThrow();
  });

  it("diagram with exactly 16 edges → parses", () => {
    const edges = Array(16).fill({ from: "a", to: "b" });
    const result = Diagram.parse({ ...validDiagram, edges });
    expect(result.edges).toHaveLength(16);
  });

  it("invalid diagram kind → throws", () => {
    expect(() => Diagram.parse({ ...validDiagram, kind: "tree" })).toThrow();
  });

  it("diagram with 12 nodes (max) → parses", () => {
    const nodes = Array(12).fill(null).map((_, i) => ({ id: `n${i}`, label: `Node ${i}` }));
    const result = Diagram.parse({ ...validDiagram, nodes });
    expect(result.nodes).toHaveLength(12);
  });

  it("diagram with 13 nodes → throws", () => {
    const nodes = Array(13).fill(null).map((_, i) => ({ id: `n${i}`, label: `Node ${i}` }));
    expect(() => Diagram.parse({ ...validDiagram, nodes })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Chart
// ---------------------------------------------------------------------------
describe("Chart", () => {
  const validChart = {
    kind: "bar" as const,
    title: "Revenue Chart",
    points: [
      { label: "Q1", value: 100 },
      { label: "Q2", value: 200 },
    ],
  };

  it("valid bar chart → parses", () => {
    const result = Chart.parse(validChart);
    expect(result.kind).toBe("bar");
    expect(result.refs).toEqual([]);
  });

  it("valid line chart → parses", () => {
    const result = Chart.parse({ ...validChart, kind: "line" });
    expect(result.kind).toBe("line");
  });

  it("chart with non-numeric value (string that is coercible) → coerces", () => {
    const result = Chart.parse({
      ...validChart,
      points: [{ label: "Q1", value: "150" }, { label: "Q2", value: 200 }],
    });
    expect(result.points[0].value).toBe(150);
  });

  it("chart with non-numeric, non-coercible value → throws", () => {
    expect(() => Chart.parse({
      ...validChart,
      points: [{ label: "Q1", value: "not-a-number" }, { label: "Q2", value: 200 }],
    })).toThrow();
  });

  it("chart with fewer than 2 points → throws", () => {
    expect(() => Chart.parse({ ...validChart, points: [{ label: "Q1", value: 100 }] })).toThrow();
  });

  it("chart with invalid kind → throws", () => {
    expect(() => Chart.parse({ ...validChart, kind: "pie" })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// SummaryContent (full payload)
// ---------------------------------------------------------------------------
describe("SummaryContent", () => {
  it("minimal valid SummaryContent → parses", () => {
    const result = SummaryContent.parse(minimalSummaryContent());
    expect(result.title).toBe("Test Summary");
    expect(result.sections).toHaveLength(1);
    expect(result.formulas).toEqual([]);
    expect(result.tables).toEqual([]);
    expect(result.diagrams).toEqual([]);
    expect(result.charts).toEqual([]);
  });

  it("full SummaryContent with all optional fields → parses", () => {
    const full = {
      ...minimalSummaryContent(),
      formulas: [
        {
          latex: "E = mc^2",
          explanation: "Mass-energy equivalence",
          variables: [{ symbol: "E", meaning: "Energy" }],
        },
      ],
      tables: [
        {
          title: "Comparison",
          headers: ["A", "B"],
          rows: [["x", "y"]],
        },
      ],
      diagrams: [
        {
          kind: "flow",
          title: "Flow",
          nodes: [{ id: "a", label: "Start" }, { id: "b", label: "End" }],
          edges: [{ from: "a", to: "b" }],
        },
      ],
      charts: [
        {
          kind: "bar",
          title: "Stats",
          points: [{ label: "X", value: 1 }, { label: "Y", value: 2 }],
        },
      ],
    };
    const result = SummaryContent.parse(full);
    expect(result.formulas).toHaveLength(1);
    expect(result.diagrams).toHaveLength(1);
    expect(result.charts).toHaveLength(1);
  });

  it("SummaryContent with no sections → throws", () => {
    expect(() =>
      SummaryContent.parse({ ...minimalSummaryContent(), sections: [] })
    ).toThrow();
  });

  it("[DESIGN] SummaryContent with invalid language → coerces to 'en' (not a throw)", () => {
    // The schema uses z.enum(["en","ar"]).catch("en") intentionally:
    // The worker always overwrites language with the requested locale after parsing.
    // Invalid languages silently fallback to "en". This is by design, not a bug.
    const result = SummaryContent.parse({ ...minimalSummaryContent(), language: "fr" });
    expect(result.language).toBe("en");
  });

  it("SummaryContent with missing title → throws", () => {
    const { title: _t, ...noTitle } = minimalSummaryContent();
    expect(() => SummaryContent.parse(noTitle)).toThrow();
  });

  it("SummaryContent with missing overview → throws", () => {
    const { overview: _o, ...noOverview } = minimalSummaryContent();
    expect(() => SummaryContent.parse(noOverview)).toThrow();
  });

  it("Points within sections: text exceeding 2000 chars → throws", () => {
    const payload = {
      ...minimalSummaryContent(),
      sections: [
        {
          heading: "Section 1",
          points: [{ text: "x".repeat(2001) }],
        },
      ],
    };
    expect(() => SummaryContent.parse(payload)).toThrow();
  });

  it("Diagram with fewer than 2 nodes within SummaryContent → throws", () => {
    const payload = {
      ...minimalSummaryContent(),
      diagrams: [
        {
          kind: "flow",
          title: "D",
          nodes: [{ id: "a", label: "Only" }],
          edges: [],
        },
      ],
    };
    expect(() => SummaryContent.parse(payload)).toThrow();
  });

  it("Diagram with more than 16 edges within SummaryContent → throws", () => {
    const edges = Array(17).fill({ from: "a", to: "b" });
    const payload = {
      ...minimalSummaryContent(),
      diagrams: [
        {
          kind: "flow",
          title: "D",
          nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
          edges,
        },
      ],
    };
    expect(() => SummaryContent.parse(payload)).toThrow();
  });

  it("SourceRef with invalid kind → throws", () => {
    const payload = {
      ...minimalSummaryContent(),
      sections: [
        {
          heading: "S",
          refs: [{ kind: "invalid_kind", start: 1 }],
        },
      ],
    };
    expect(() => SummaryContent.parse(payload)).toThrow();
  });

  it("Emphasis.reason exceeding 600 chars in section → throws", () => {
    const payload = {
      ...minimalSummaryContent(),
      sections: [
        {
          heading: "S",
          emphasis: [
            { topic: "T", reason: "r".repeat(601) },
          ],
        },
      ],
    };
    expect(() => SummaryContent.parse(payload)).toThrow();
  });

  it("Arabic language → parses", () => {
    const result = SummaryContent.parse({ ...minimalSummaryContent(), language: "ar" });
    expect(result.language).toBe("ar");
  });
});

// ---------------------------------------------------------------------------
// Zod defaults verification
// ---------------------------------------------------------------------------
describe("Zod defaults", () => {
  it("Point without refs → refs defaults to []", () => {
    const result = Point.parse({ text: "No refs point" });
    expect(result.refs).toEqual([]);
    expect(Array.isArray(result.refs)).toBe(true);
  });

  it("Point without exam → exam defaults to false", () => {
    const result = Point.parse({ text: "Not exam" });
    expect(result.exam).toBe(false);
  });

  it("Section without points → points defaults to []", () => {
    const result = Section.parse({ heading: "Empty section" });
    expect(result.points).toEqual([]);
  });

  it("Section without importance → importance defaults to 'normal'", () => {
    const result = Section.parse({ heading: "Section" });
    expect(result.importance).toBe("normal");
  });

  it("Coverage without analyzed → analyzed defaults to []", () => {
    const result = Coverage.parse({});
    expect(result.analyzed).toEqual([]);
    expect(result.unreadable).toEqual([]);
    expect(result.possibleGaps).toEqual([]);
  });

  it("Emphasis without audioOnly → audioOnly defaults to false", () => {
    const result = Emphasis.parse({ topic: "T", reason: "R" });
    expect(result.audioOnly).toBe(false);
  });

  it("Emphasis without confidence → confidence defaults to 0.5", () => {
    const result = Emphasis.parse({ topic: "T", reason: "R" });
    expect(result.confidence).toBe(0.5);
  });
});
