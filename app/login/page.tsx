import { Mark } from "@/lib/icons";
import AuthFrag from "@/app/auth-frag";

export default function LoginPage() {
  return (
    <div className="auth">
      <div className="auth-col">
        <div className="brand">
          <Mark size={22} />
          <span className="wordmark">Margins</span>
        </div>
        <div className="auth-card">
          <h1>Log in</h1>
          <form>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input className="input" id="email" name="email" type="email" autoComplete="email" placeholder="you@uni.edu" />
            </div>
            <div className="field">
              <div className="row-between">
                <label htmlFor="password">Password</label>
                <a className="link-quiet" href="/reset">Forgot?</a>
              </div>
              <input className="input" id="password" name="password" type="password" autoComplete="current-password" placeholder="Your password" />
            </div>
            <button className="btn primary lg" type="submit">Log in</button>
          </form>
        </div>
        <p className="links">
          New here? <a href="/signup">Create account</a>
        </p>
      </div>
      <AuthFrag caption="Log in, and today’s summary is waiting where you left it." />
    </div>
  );
}
