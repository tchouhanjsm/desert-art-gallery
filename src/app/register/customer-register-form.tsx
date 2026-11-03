"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerCustomer, type CustomerRegistrationState } from "./actions";

const initialState: CustomerRegistrationState = {};

export function CustomerRegisterForm() {
  const [state, action, pending] = useActionState(registerCustomer, initialState);
  return (
    <section className="page-shell">
      <div className="page-heading"><div className="section-kicker">JOIN THE GALLERY</div><h1>Create your account</h1><p>Save favourite pieces and keep your delivery details together.</p></div>
      <form action={action} className="auth-form">
        <label>Your name<input name="display_name" autoComplete="name" minLength={2} maxLength={160} required /></label>
        <label>Email address<input name="email" type="email" autoComplete="email" maxLength={255} required /></label>
        <label>Password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label>
        <label>Confirm password<input name="password_confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label>
        {state.error && <p className="form-message" role="alert">{state.error}</p>}
        <button className="button-primary dark-button" type="submit" disabled={pending}>{pending ? "CREATING ACCOUNT…" : "CREATE ACCOUNT"}</button>
      </form>
      <div className="auth-links"><Link href="/login">Already have an account? Sign in</Link><Link href="/contact">Contact the gallery</Link></div>
      <p className="form-message">Email verification is not active yet. Use an email address you can access and keep your password secure.</p>
    </section>
  );
}
