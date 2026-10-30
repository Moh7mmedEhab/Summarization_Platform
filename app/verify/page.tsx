import { Mark } from "@/lib/icons";
import AuthFrag from "@/app/auth-frag";

export default function VerifyPage() {
  return (
    <div className="auth">
      <div className="auth-col">
        <div className="brand">
          <Mark size={22} />
          <span className="wordmark">Margins</span>
        </div>
        <div className="auth-card">
          <h1>Verify your email</h1>
          <p className="sub">
            We sent a 6-digit code to <b>l.haddad@uni.edu</b>. It expires in 10 minutes.
          </p>
          <form>
            <div className="field">
              <label htmlFor="code-1">Code</label>
              <div className="code">
                <input id="code-1" inputMode="numeric" autoComplete="one-time-code" maxLength={1} defaultValue="3" aria-label="Digit 1" />
                <input inputMode="numeric" maxLength={1} defaultValue="8" aria-label="Digit 2" />
                <input inputMode="numeric" maxLength={1} defaultValue="4" aria-label="Digit 3" />
                <input inputMode="numeric" maxLength={1} defaultValue="1" aria-label="Digit 4" />
                <input inputMode="numeric" maxLength={1} defaultValue="2" aria-label="Digit 5" />
                <input inputMode="numeric" maxLength={1} defaultValue="9" aria-label="Digit 6" />
              </div>
            </div>
            <button className="btn primary lg" type="submit">Verify</button>
            <p className="hint-cite">Resend available in 0:42 · <a className="link-quiet" href="/signup">Wrong address?</a></p>
          </form>
        </div>
        <p className="links">
          Stuck? <a href="/login">Log in instead</a>
        </p>
      </div>
      <AuthFrag caption="Verify, and the library opens." />
    </div>
  );
}
