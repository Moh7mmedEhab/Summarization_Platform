import { Mark } from "@/lib/icons";
import AuthFrag from "@/app/auth-frag";

export default function ResetPage() {
  return (
    <div className="auth">
      <div className="auth-col">
        <div className="brand">
          <Mark size={22} />
          <span className="wordmark">Margins</span>
        </div>
        <div className="auth-card">
          <h1>Reset password</h1>
          <p className="sub">
            Enter the email you study with, and we send a link to set a new password.
          </p>
          <form>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input className="input" id="email" name="email" type="email" autoComplete="email" placeholder="you@uni.edu" />
            </div>
            <button className="btn primary lg" type="submit">Send reset link</button>
          </form>
        </div>
        <p className="links">
          Remembered it? <a href="/login">Log in</a>
        </p>
      </div>
      <AuthFrag caption="One link, and you are back to your reading." />
    </div>
  );
}
