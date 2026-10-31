"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/lib/i18n/navigation";
import { authClient } from "@/lib/auth/client";
import {
  Mark,
  SummarizeIcon,
  SaveIcon,
  MenuIcon,
  CloseIcon,
  SlidersIcon,
  UserIcon,
  LogoutIcon,
} from "@/components/icons";

/*
The shell: a labelled sidebar on the page ground (desktop), which folds into a
48px top bar on a phone (menu opens the full-screen sheet). Driven by the
signed-in user, the active screen, and the interface language.
*/

export type ShellUser = { name: string; email: string; initials: string };

export default function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");

  const screen = pathname.startsWith("/library")
    ? "library"
    : pathname.startsWith("/preferences")
      ? "preferences"
      : pathname.startsWith("/profile")
        ? "profile"
        : "summarize";
  const screenName = {
    summarize: t("summarize"),
    library: t("library"),
    preferences: t("preferences"),
    profile: t("profile"),
  }[screen];

  const navItem = (
    href: string,
    current: boolean,
    icon: React.ReactNode,
    label: string,
  ) => (
    <Link
      className="nav-item"
      href={href as never}
      aria-current={current ? "page" : undefined}
      onClick={() => setOpen(false)}
    >
      {icon}
      {label}
    </Link>
  );

  const signOut = async () => {
    await authClient.signOut();
    router.replace("/login");
  };

  return (
    <div className="app">
      <aside className={open ? "sidebar open" : "sidebar"}>
        <div className="close-row">
          <button className="iconbtn" aria-label={tCommon("closeMenu")} onClick={() => setOpen(false)}>
            <CloseIcon />
          </button>
        </div>
        <div className="brand">
          <Mark size={22} />
          <span className="wordmark">Margins</span>
        </div>
        <p className="scope-label">{t("studyLibrary")}</p>
        <div className="scope">
          <span className="avatar">{user.initials}</span>
          <span className="who">
            <b>{user.name}</b>
            <span>{user.email}</span>
          </span>
        </div>
        <p className="group-label">{t("groupLibrary")}</p>
        <nav aria-label={t("groupLibrary")}>
          {navItem("/", pathname === "/", <SummarizeIcon />, t("summarize"))}
          {navItem("/library", pathname.startsWith("/library"), <SaveIcon />, t("library"))}
        </nav>
        <div className="bottom">
          <p className="group-label">{t("groupAccount")}</p>
          {navItem("/preferences", pathname.startsWith("/preferences"), <SlidersIcon />, t("preferences"))}
          {navItem("/profile", pathname.startsWith("/profile"), <UserIcon />, t("profile"))}
          <button className="nav-item" type="button" onClick={signOut}>
            <LogoutIcon />
            {t("signOut")}
          </button>
        </div>
      </aside>
      <div>
        <div className="phonebar">
          <button className="iconbtn" aria-label={tCommon("openMenu")} onClick={() => setOpen(true)}>
            <MenuIcon />
          </button>
          <span className="name">{screenName}</span>
          <span style={{ width: 40 }} aria-hidden />
        </div>
        <main className="canvas">{children}</main>
      </div>
    </div>
  );
}
