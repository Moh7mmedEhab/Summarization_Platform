// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import ChartFigure from "@/components/summary/chart-figure";
import DiagramFigure from "@/components/summary/diagram-figure";
import type { ChartT, DiagramT } from "@/lib/ai/schema";

describe("Visual Figures (ChartFigure & DiagramFigure)", () => {
  describe("ChartFigure", () => {
    const barChart: ChartT = {
      title: "Cell Cycle Phase Durations",
      kind: "bar",
      unit: "hours",
      points: [
        { label: "G1", value: 10 },
        { label: "S", value: 8 },
        { label: "G2", value: 4 },
        { label: "M", value: 2 },
      ],
      refs: [{ kind: "page", start: 12 }],
    };

    it("renders bar chart title, unit, and SVG elements", () => {
      const { container } = render(<ChartFigure chart={barChart} />);
      expect(screen.getByText(/Cell Cycle Phase Durations/i)).toBeInTheDocument();
      expect(screen.getByText(/\(hours\)/i)).toBeInTheDocument();

      const rects = container.querySelectorAll("svg rect");
      expect(rects.length).toBe(4);
    });

    it("renders line chart with valid path", () => {
      const lineChart: ChartT = {
        title: "Enzyme Activity vs Temperature",
        kind: "line",
        points: [
          { label: "20C", value: 15 },
          { label: "37C", value: 95 },
          { label: "60C", value: 5 },
        ],
        refs: [],
      };
      const { container } = render(<ChartFigure chart={lineChart} />);
      const paths = container.querySelectorAll("svg path");
      expect(paths.length).toBeGreaterThan(0);
    });
  });

  describe("DiagramFigure", () => {
    const flowDiagram: DiagramT = {
      title: "Cellular Respiration Flow",
      kind: "flow",
      nodes: [
        { id: "gly", label: "Glycolysis", order: 1 },
        { id: "krebs", label: "Krebs Cycle", order: 2 },
        { id: "etc", label: "Electron Transport Chain", order: 3 },
      ],
      edges: [
        { from: "gly", to: "krebs", label: "pyruvate" },
        { from: "krebs", to: "etc", label: "NADH/FADH2" },
      ],
      refs: [{ kind: "paragraph", start: 3 }],
    };

    it("renders diagram title, nodes, and edges without script injection", () => {
      const { container } = render(<DiagramFigure diagram={flowDiagram} />);
      expect(screen.getByText(/Cellular Respiration Flow/i)).toBeInTheDocument();

      const nodeBoxes = container.querySelectorAll("svg rect");
      expect(nodeBoxes.length).toBe(3);

      expect(screen.getByText("Glycolysis")).toBeInTheDocument();
      expect(screen.getByText("Krebs Cycle")).toBeInTheDocument();
      expect(screen.getByText("pyruvate")).toBeInTheDocument();
    });
  });
});

