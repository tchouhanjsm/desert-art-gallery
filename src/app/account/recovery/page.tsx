"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function AccountRecoveryPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (password !== confirmation) { setMessage("The passwords do not match."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }), cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We could not update your password.");
      setMessage("Your password has been updated. You can now sign in.");
      setPassword(""); setConfirmation("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not update your password.");
    } finally { setBusy(false); }
  }

  return <section className="page-shell">
    <div className="page-heading"><div className="section-kicker">ACCOUNT SECURITY</div><h1>Choose a new password</h1><p>Use a unique password of at least 12 characters.</p></div>
    {!token ? <div className="empty-note">The recovery link is missing or invalid. <Link href="/login">Request a new link</Link>.</div> : <form onSubmit={submit} className="auth-form">
      <label>New password<input type="password" autoComplete="new-password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)} required/></label>
      <label>Confirm new password<input type="password" autoComplete="new-password" minLength={12} value={confirmation} onChange={e=>setConfirmation(e.target.value)} required/></label>
      <button className="button-primary dark-button" disabled={busy}>{busy?"UPDATING…":"UPDATE PASSWORD"}</button>
      <p role="status" aria-live="polite" className="form-message">{message}</p>
      <Link href="/login">Return to sign in</Link>
    </form>}
  </section>;
}
