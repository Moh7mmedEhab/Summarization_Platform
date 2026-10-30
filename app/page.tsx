"use client";

import { useEffect } from "react";

// Design scaffold: the app root lands on the Summarize screen.
export default function Home() {
  useEffect(() => {
    window.location.replace("/summarize");
  }, []);
  return (
    <div className="auth">
      <p className="sub">
        Opening Summarize… <a href="/summarize">continue</a>
      </p>
    </div>
  );
}
