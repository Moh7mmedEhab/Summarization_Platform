import AppShell from "../app-shell";
import ThemeControls from "../theme-controls";
import ThemeStamp from "../theme-stamp";
import SummaryNote from "../summary-note";

/*

Screen question: "How does the app look?" Section rows per references/app-screens.md 8.2:
a label column (title, description, and for the preview the rule's "summary of current
values") beside the panel, full-width rules between sections.

*/

export default function SettingsPage() {
  return (
    <AppShell screen="settings">
      <div className="title-row">
        <div>
          <h1>Appearance</h1>
          <p className="sub">Change it once; the whole app repaints at once.</p>
        </div>
      </div>

      <section className="setsec" aria-labelledby="theme-h">
        <div className="lab">
          <h2 id="theme-h">Theme</h2>
          <p>
            Set your reading mode and the accent of every margin. Saved in this browser for
            now; later it follows your account everywhere.
          </p>
        </div>
        <div className="panel">
          <ThemeControls />
        </div>
      </section>

      <section className="setsec" aria-labelledby="preview-h">
        <div className="lab">
          <h2 id="preview-h">Live preview</h2>
          <p>
            The margin rail every summary gets, painted by your theme as it reads now:
          </p>
          <p className="now num">
            Now: <ThemeStamp />
          </p>
        </div>
        <div className="panel">
          <SummaryNote />
        </div>
      </section>
    </AppShell>
  );
}
