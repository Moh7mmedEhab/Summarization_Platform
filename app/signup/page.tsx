import { Mark } from "@/lib/icons";
import AuthFrag from "@/app/auth-frag";

export default function SignupPage() {
  return (
    <div className="auth">
      <div className="auth-col">
        <div className="brand">
          <Mark size={22} />
          <span className="wordmark">Margins</span>
        </div>
        <div className="auth-card">
          <h1>Create account</h1>
          <form>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input className="input" id="name" name="name" autoComplete="name" placeholder="Lina Haddad" />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input className="input" id="email" name="email" type="email" autoComplete="email" placeholder="you@uni.edu" />
            </div>
            <div className="field">
              <label htmlFor="password" aria-describedby="pw-criteria">Password</label>
              <input className="input" id="password" name="password" type="password" autoComplete="new-password" aria-describedby="pw-criteria" />
              <p className="criteria" id="pw-criteria">At least 8 characters, with one number.</p>
            </div>
            <button className="btn primary lg" type="submit">Create account</button>
          </form>
        </div>
        <p className="links">
          Already studying here? <a href="/login">Log in</a>
        </p>
      </div>
      <AuthFrag caption="Create an account, drop your first reading, and keep the points that matter." />
    </div>
  );
}
