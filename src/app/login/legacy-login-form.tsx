"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getSafeRedirectPath } from "@/lib/safe-redirect";

function safeNextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return getSafeRedirectPath(next, window.location.origin, "/account");
}

export function LegacyLoginForm() {
  const [mode, setMode] = useState<"login" | "recover">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Customer sign-in is not configured yet. Please contact the gallery.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "recover") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/account/recovery`,
        });
        if (error) throw error;
        setMessage("If an account exists, a secure reset link will be sent to this email address.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign(safeNextPath());
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not complete that request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="page-shell">
    <div className="page-heading"><div className="section-kicker">DESERT ART GALLERY</div><h1>{mode === "login" ? "Welcome back" : "Reset your account password"}</h1><p>{mode === "login" ? "Sign in to view your account details and order history." : "If an account exists, we will send a secure password reset link."}</p></div>
    <form onSubmit={submit} className="auth-form">
      <label>Email address<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
      {mode === "login" && <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8}/></label>}
      <button className="button-primary dark-button" disabled={busy}>{busy ? "Working…" : mode === "login" ? "Sign in" : "Send reset link"}</button>
      <p className="form-message" role="status" aria-live="polite">{message}</p>
    </form>
    <div className="auth-links">
      <button onClick={()=>{setMode(mode==="login"?"recover":"login");setMessage("");}}>{mode==="login"?"Forgot your password?":"Back to sign in"}</button>
      <Link href="/contact">Need help? Contact the gallery</Link>
    </div>
  </section>;
}
