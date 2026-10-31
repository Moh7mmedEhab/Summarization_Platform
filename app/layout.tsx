/**
 * Root layout: only a pass-through. The real <html> is rendered per locale in
 * app/[locale]/layout.tsx so lang/dir can follow the matched language.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
