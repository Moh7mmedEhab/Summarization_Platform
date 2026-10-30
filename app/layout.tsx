import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Margins, summarize and keep what you read",
  description:
    "Margins is a study library for students: paste text or drop in a PDF and get the summary, and keep texts, documents and images in one place.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
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
