"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LegacyRecoveryForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (password !== confirmation) {
      setMessage("The passwords do not match.");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Account recovery is not configured. Please contact the gallery.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage("Your password has been updated. You can now sign in.");
      setPassword("");
      setConfirmation("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not update your password.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="page-shell">
    <div className="page-heading"><div className="section-kicker">ACCOUNT SECURITY</div><h1>Choose a new password</h1><p>Use a unique password of at least 12 characters.</p></div>
    <form onSubmit={submit} className="auth-form">
      <label>New password<input type="password" autoComplete="new-password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)} required/></label>
      <label>Confirm new password<input type="password" autoComplete="new-password" minLength={12} value={confirmation} onChange={e=>setConfirmation(e.target.value)} required/></label>
      <button className="button-primary dark-button" disabled={busy}>{busy?"UPDATING…":"UPDATE PASSWORD"}</button>
      <p role="status" aria-live="polite" className="form-message">{message}</p>
      <Link href="/login">Return to sign in</Link>
    </form>
  </section>;
}
