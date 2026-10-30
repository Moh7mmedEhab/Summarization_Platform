import type { Metadata } from "next";
import "./globals.css";
import "./themes.css";

export const metadata: Metadata = {
  title: "Margins, summarize and keep what you read",
  description:
    "Margins is a study library for students: paste text or drop in a PDF and get the summary, and keep texts, documents and images in one place.",
};

// Runs before first paint: restores the saved theme, then QA-only URL overrides
// (?appearance=&accent=) that are deliberately not persisted.
const themeInit = `try{var t=JSON.parse(localStorage.getItem("margins-theme")||"{}");var a=t.appearance==="dark"?"dark":"light";var C=["rose","lavender","peach","berry","mint","sky","plum"];var c=C.indexOf(t.accent)>-1?t.accent:"rose";var q=new URLSearchParams(location.search);if(q.get("appearance")==="dark")a="dark";if(q.get("appearance")==="light")a="light";if(C.indexOf(q.get("accent"))>-1)c=q.get("accent");var d=document.documentElement;d.dataset.appearance=a;d.dataset.accent=c}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
