"use client";

import { useActionState } from "react";
import { signInLocalOwner, type LocalOwnerLoginState } from "./actions";

const initialState: LocalOwnerLoginState = {};

export default function LocalOwnerLoginPage() {
  const [state, action, pending] = useActionState(signInLocalOwner, initialState);
  return (
    <main className="page-shell">
      <section className="auth-panel">
        <div className="section-kicker">DESERT ART GALLERY · OWNER ACCESS</div>
        <h1>Owner sign in</h1>
        <p>Sign in to manage the self-hosted catalogue and gallery operations.</p>
        <form action={action} className="auth-form">
          <label>Email address
            <input name="email" type="email" autoComplete="username" maxLength={255} required />
          </label>
          <label>Password
            <input name="password" type="password" autoComplete="current-password" minLength={12} maxLength={256} required />
          </label>
          {state.error && <p className="form-message" role="alert">{state.error}</p>}
          <button className="button-primary dark-button" type="submit" disabled={pending}>
            {pending ? "SIGNING IN…" : "SIGN IN TO OWNER WORKSPACE"}
          </button>
        </form>
        <p className="form-message">Owner access is provisioned by the one-time local bootstrap command. Customer account sign-in is separate.</p>
      </section>
    </main>
  );
}
