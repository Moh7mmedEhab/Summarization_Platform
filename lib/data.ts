// Margins — sample library data. All counts are computed from these rows;
// nothing is typed in twice (a fact shown twice is one variable).
export type ItemKind = "document" | "text" | "image";

export type SavedItem = {
  id: string;
  title: string;
  kind: ItemKind;
  /** type glyph shown in the 48px media slot */
  ext: "PDF" | "DOCX" | "Pasted text" | "Image";
  /** size in the unit the item knows: pages for documents, words for texts, MB for images */
  size: string;
  /** number of extracted key points, or null when this item has none yet */
  points: number | null;
  /** share of the source the summary keeps, or null when there is no summary */
  kept: number | null;
  saved: string; // relative date in words
};

export const items: SavedItem[] = [
  {
    id: "photosynthesis-l3",
    title: "Photosynthesis (Lecture 3)",
    kind: "document",
    ext: "PDF",
    size: "12 pages",
    points: 4,
    kept: 34,
    saved: "Yesterday",
  },
  {
    id: "cognitive-load",
    title: "Cognitive Load and Handwritten Notes (Oppenheimer 2014)",
    kind: "document",
    ext: "PDF",
    size: "8 pages",
    points: 4,
    kept: 22,
    saved: "2 days",
  },
  {
    id: "orgchem-vocab",
    title: "Organic Chemistry, Chapter 3 vocabulary",
    kind: "text",
    ext: "Pasted text",
    size: "1,042 words",
    points: 6,
    kept: 18,
    saved: "3 days",
  },
  {
    id: "lab-report-v1",
    title: "Enzyme Kinetics, lab report v1",
    kind: "document",
    ext: "DOCX",
    size: "6 pages",
    points: null, // saved without summarizing; the row offers the action
    kept: null,
    saved: "5 days",
  },
  {
    id: "spanish-verbs",
    title: "Spanish irregular verbs, drill sheet",
    kind: "text",
    ext: "Pasted text",
    size: "186 words",
    points: 3,
    kept: 21,
    saved: "7 days",
  },
  {
    id: "whiteboard-kinetics",
    title: "Whiteboard photo, enzyme kinetics",
    kind: "image",
    ext: "Image",
    size: "1.8 MB",
    points: null,
    kept: null, // images are kept, not summarized
    saved: "11 days",
  },
  {
    id: "plant-cell",
    title: "Plant cell diagram (photograph)",
    kind: "image",
    ext: "Image",
    size: "940 KB",
    points: null,
    kept: null,
    saved: "18 days",
  },
];

export const countBy = (kind: ItemKind) =>
  items.filter((i) => i.kind === kind).length;

export const kindLabel: Record<ItemKind, string> = {
  document: "Documents",
  text: "Texts",
  image: "Images",
};

// The data must reconcile itself; failures print to the console.
console.assert(countBy("document") + countBy("text") + countBy("image") === items.length,
  "chip counts must add to the total");
