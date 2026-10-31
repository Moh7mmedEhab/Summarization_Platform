import { describe, it, expect } from "vitest";
import { SourceRef, SummaryContent } from "@/lib/ai/schema";
import { styleDirective } from "@/lib/ai/prompts";

describe("AI Pipeline Logic & Contracts (lib/ai/pipeline.ts & prompts.ts)", () => {
  describe("Style Directives", () => {
    it("returns correct prompt directives for each style", () => {
      expect(styleDirective("comprehensive")).toContain("most complete notes possible");
      expect(styleDirective("key_points")).toContain("preserve every distinct fact and reference");
      expect(styleDirective("paragraph")).toContain("flowing prose content");
      expect(styleDirective("exam_prep")).toContain("prioritize exam-ready material");
      expect(styleDirective("unknown")).toContain("most complete notes possible");
    });
  });

  describe("SummaryContent Schema Contract Verification", () => {
    it("validates a structured summary payload with definitions, points, emphasis, and diagrams", () => {
      const validPayload = {
        title: "Cell Division and Mitosis",
        language: "en",
        overview: "An overview of the phases of mitosis and its biological significance.",
        sections: [
          {
            heading: "Phases of Mitosis",
            importance: "high",
            points: [
              {
                lead: "Four distinct stages.",
                text: "Mitosis progresses through prophase, metaphase, anaphase, and telophase.",
                refs: [{ kind: "page", start: 1, end: 2 }],
                exam: true,
              },
            ],
            definitions: [
              {
                term: "Cytokinesis",
                meaning: "The physical process of cell division, dividing the cytoplasm of a parental cell into two daughter cells.",
                refs: [{ kind: "paragraph", start: 5 }],
              },
            ],
            emphasis: [
              {
                topic: "Metaphase checkpoint",
                reason: "Crucial for preventing aneuploidy in daughter cells",
                quote: "Remember this checkpoint for the final exam!",
                timeStart: 120,
                timeEnd: 145,
                ref: { kind: "timestamp", start: 120, end: 145 },
              },
            ],
          },
        ],
        diagrams: [
          {
            title: "Mitotic Sequence",
            kind: "flow",
            nodes: [
              { id: "p", label: "Prophase", order: 1 },
              { id: "m", label: "Metaphase", order: 2 },
              { id: "a", label: "Anaphase", order: 3 },
            ],
            edges: [
              { from: "p", to: "m", label: "align" },
              { from: "m", to: "a", label: "separate" },
            ],
            refs: [],
          },
        ],
        charts: [
          {
            title: "Cell Cycle Duration",
            kind: "bar",
            unit: "hours",
            points: [
              { label: "G1", value: 10 },
              { label: "S", value: 8 },
              { label: "G2", value: 4 },
              { label: "M", value: 2 },
            ],
            refs: [],
          },
        ],
        coverage: {
          analyzed: ["Section 1", "Section 2"],
          unreadable: [],
          possibleGaps: [],
        },
      };

      const parsed = SummaryContent.safeParse(validPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.title).toBe("Cell Division and Mitosis");
        expect(parsed.data.sections[0].points[0].exam).toBe(true);
        expect(parsed.data.sections[0].emphasis?.[0]?.quote).toBe("Remember this checkpoint for the final exam!");
        expect(parsed.data.sections[0].emphasis?.[0]?.timeStart).toBe(120);
        expect(parsed.data.diagrams?.[0]?.nodes.length).toBe(3);
      }
    });

    it("rejects summary payloads with empty sections array", () => {
      const invalidPayload = {
        title: "Empty Subject",
        language: "en",
        overview: "Valid overview",
        sections: [], // .min(1) required by SummaryContent
      };
      const result = SummaryContent.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it("rejects diagram with fewer than 2 nodes", () => {
      const invalidDiagram = {
        title: "Invalid Flow",
        kind: "flow",
        nodes: [{ id: "solo", label: "Solo Node" }], // min(2) required
        edges: [],
        refs: [],
      };
      const validPayload = {
        title: "Test",
        language: "en",
        overview: "Overview",
        sections: [{ heading: "H1", points: [{ text: "p1" }] }],
        diagrams: [invalidDiagram],
      };
      const result = SummaryContent.safeParse(validPayload);
      expect(result.success).toBe(false);
    });

    it("rejects diagram with more than 16 edges", () => {
      const nodes = Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, label: `Node ${i}` }));
      const edges = Array.from({ length: 20 }, (_, i) => ({ from: "n0", to: `n${(i % 9) + 1}` }));
      const payload = {
        title: "Too Many Edges",
        language: "en",
        overview: "Overview",
        sections: [{ heading: "H1", points: [{ text: "p1" }] }],
        diagrams: [{ title: "Dense Diagram", kind: "flow", nodes, edges, refs: [] }],
      };
      const result = SummaryContent.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("Audio Timestamp & Evidence Association", () => {
    it("ensures timestamp references have valid numeric ranges", () => {
      const validRef = {
        kind: "timestamp" as const,
        start: 75.5,
        end: 110.2,
        label: "Discussion of thermodynamics",
      };
      const parsed = SourceRef.safeParse(validRef);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.start).toBe(75.5);
        expect(parsed.data.end).toBe(110.2);
      }
    });
  });
});
