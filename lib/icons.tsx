import type { SVGProps } from "react";

// One outline set, 16px base, ~1.5px stroke, grey by default (color: inherit).
const base = (props: SVGProps<SVGSVGElement>) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  width: 16,
  height: 16,
  "aria-hidden": true,
});

export const PenIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

export const DocIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
    <path d="M9 13h6M9 17h6" />
  </svg>
);

export const TextIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 6h16M4 10h16M4 14h10M4 18h7" />
  </svg>
);

export const ImageIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m3 17 5.2-4.6a1.4 1.4 0 0 1 1.9 0L16 17" />
    <path d="m14.5 15.2 2.1-1.9a1.4 1.4 0 0 1 1.9 0L21 16" />
  </svg>
);

export const SearchIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </svg>
);

export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const MenuIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const SummarizeIcon = (p: SVGProps<SVGSVGElement>) => (
  // lined page with a pen mark in the margin — the product's own idea
  <svg {...base(p)}>
    <path d="M4 5h16M4 9h12M4 13h12M4 17h9" />
    <path d="m19.5 11.5-3 3-.8 2 2-.8 3-3a1.06 1.06 0 0 0-1.5-1.5Z" />
  </svg>
);

export const SaveIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M5 4h11l3 3v13H5Z" />
    <path d="M8 4v5h7V4M8 20v-6h8v6" />
  </svg>
);

export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
);

// The product mark: a page with its margin line drawn in the accent.
export const Mark = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="3.25" y="2.25" width="17.5" height="19.5" rx="2.75" stroke="#111827" strokeWidth="1.5" />
    <line x1="8.5" y1="6.5" x2="8.5" y2="17.5" stroke="#b8336a" strokeWidth="2" strokeLinecap="round" />
    <line x1="11.5" y1="9" x2="16.5" y2="9" stroke="#b8336a" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="11.5" y1="13" x2="15" y2="13" stroke="#b8336a" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const Wordmark = () => (
  <span className="wordmark">Margins</span>
);
