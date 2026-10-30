import { Mark } from "@/lib/icons";
import AuthFrag from "@/app/auth-frag";

export default function ResetNewPage() {
  return (
    <div className="auth">
      <div className="auth-col">
        <div className="brand">
          <Mark size={22} />
          <span className="wordmark">Margins</span>
        </div>
        <div className="auth-card">
          <h1>Set a new password</h1>
          <form>
            <div className="field">
              <label htmlFor="new-password" aria-describedby="pw-criteria">New password</label>
              <input className="input" id="new-password" name="password" type="password" autoComplete="new-password" aria-describedby="pw-criteria" />
              <p className="criteria" id="pw-criteria">At least 8 characters, with one number.</p>
            </div>
            <div className="field">
              <label htmlFor="confirm">Confirm new password</label>
              <input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" />
            </div>
            <button className="btn primary lg" type="submit">Save password</button>
          </form>
        </div>
        <p className="links">
          Done already? <a href="/login">Log in</a>
        </p>
      </div>
      <AuthFrag caption="One save, and the library is yours again." />
    </div>
  );
}
