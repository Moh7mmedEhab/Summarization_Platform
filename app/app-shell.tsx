"use client";

import { useState } from "react";
import { Mark, SummarizeIcon, SaveIcon, MenuIcon, CloseIcon } from "@/lib/icons";

/**
 * The open-plane shell: a labelled sidebar on the page ground (desktop), which folds
 * into a 48px top bar on a phone (menu opens the full-screen sheet).
 */
export default function AppShell({
  screen,
  children,
}: {
  screen: "summarize" | "save";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="app">
      <aside className={open ? "sidebar open" : "sidebar"}>
        <div className="close-row">
          <button className="iconbtn" aria-label="Close menu" onClick={() => setOpen(false)}>
            <CloseIcon />
          </button>
        </div>
        <div className="brand">
          <Mark size={22} />
          <span className="wordmark">Margins</span>
        </div>
        <p className="scope-label">Study library</p>
        <div className="scope">
          <span className="avatar">LH</span>
          <span className="who">
            <b>Lina Haddad</b>
            <span>l.haddad@uni.edu</span>
          </span>
        </div>
        <p className="group-label">Library</p>
        <nav aria-label="Library">
          <a className="nav-item" href="/summarize" aria-current={screen === "summarize" ? "page" : undefined}>
            <SummarizeIcon />
            Summarize
          </a>
          <a className="nav-item" href="/save" aria-current={screen === "save" ? "page" : undefined}>
            <SaveIcon />
            Save
          </a>
        </nav>
        <div className="bottom">
          <p className="group-label">Account</p>
          <a className="nav-item" href="/login">
            Log out
          </a>
        </div>
      </aside>
      <div>
        <div className="phonebar">
          <button className="iconbtn" aria-label="Open menu" onClick={() => setOpen(true)}>
            <MenuIcon />
          </button>
          <span className="name">{screen === "summarize" ? "Summarize" : "Library"}</span>
          {screen === "save" ? (
            <button className="iconbtn" aria-label="Add to library">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" width={20} height={20} aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          ) : (
            <span style={{ width: 40 }} aria-hidden />
          )}
        </div>
        <main className="canvas">{children}</main>
      </div>
    </div>
  );
}
