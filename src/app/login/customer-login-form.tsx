"use client";

import Link from "next/link";
import { useEffect, useState, useActionState } from "react";
import { signInCustomer, type CustomerLoginState } from "./actions";

const initialState: CustomerLoginState = {};

export function CustomerLoginForm() {
  const [state, action, pending] = useActionState(signInCustomer, initialState);
  const [next, setNext] = useState("/account");
  useEffect(() => {
    const candidate = new URLSearchParams(window.location.search).get("next");
    if (candidate && candidate.startsWith("/") && !candidate.startsWith("//") && !candidate.includes("\\")) {
      setNext(candidate);
    }
  }, []);

  return (
    <section className="page-shell">
      <div className="page-heading"><div className="section-kicker">DESERT ART GALLERY</div><h1>Welcome back</h1><p>Sign in to view your wishlist and manage delivery details.</p></div>
      <form action={action} className="auth-form">
        <input type="hidden" name="next" value={next} />
        <label>Email address<input name="email" type="email" autoComplete="email" maxLength={255} required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" minLength={12} maxLength={256} required /></label>
        {state.error && <p className="form-message" role="alert">{state.error}</p>}
        <button className="button-primary dark-button" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      </form>
      <div className="auth-links"><Link href="/register">Create an account</Link><Link href="/contact">Need help? Contact us</Link></div>
      <p className="form-message">Password recovery by email is not enabled yet. Contact the gallery for assistance.</p>
    </section>
  );
}
