import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import AppShell from "@/components/layout/app-shell";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

/** Auth gate + shell: no session → the localized login screen. */
export default async function WorkspaceLayout({ children, params }: Props) {
  const { locale } = await params;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  return (
    <AppShell
      user={{
        name: session.user.name,
        email: session.user.email,
        initials: initialsOf(session.user.name),
      }}
    >
      {children}
    </AppShell>
  );
}
