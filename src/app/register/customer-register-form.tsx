"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerCustomer, type CustomerRegistrationState } from "./actions";

const initialState: CustomerRegistrationState = {};

export function CustomerRegisterForm() {
  const [state, action, pending] = useActionState(registerCustomer, initialState);
  return (
    <section className="page-shell">
      <div className="page-heading"><div className="section-kicker">CREATE ACCOUNT</div><h1>Create an account</h1><p>Save favourite pieces and manage your delivery details in one place.</p></div>
      <form action={action} className="auth-form">
        <label>Full name<input name="display_name" autoComplete="name" minLength={2} maxLength={160} required /></label>
        <label>Email address<input name="email" type="email" autoComplete="email" maxLength={255} required /></label>
        <label>Password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label>
        <label>Confirm password<input name="password_confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label>
        {state.error && <p className="form-message" role="alert">{state.error}</p>}
        <button className="button-primary dark-button" type="submit" disabled={pending}>{pending ? "Creating your account…" : "Create an account"}</button>
      </form>
      <div className="auth-links"><Link href="/login">Already have an account? Sign in</Link><Link href="/contact">Contact</Link></div>
      <p className="form-message">Email verification is not enabled yet. Use an email address you can access and keep your password secure.</p>
    </section>
  );
}
