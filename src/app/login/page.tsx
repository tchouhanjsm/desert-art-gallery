"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSafeRedirectPath } from "@/lib/safe-redirect";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const nextPath = getSafeRedirectPath(searchParams.get("next"), "http://localhost", "/account");
  const [mode, setMode] = useState<"login" | "register" | "recover">("login");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      const endpoint = mode === "recover" ? "/api/auth/forgot-password" : mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const payload = mode === "register" ? { email, fullName, password } : { email, password };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "We could not complete that request.");
      if (mode === "recover") {
        setMessage(result.message || "When the account exists, a recovery link will be provided.");
      } else {
        window.location.assign(nextPath);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not complete that request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "login" ? "Welcome back" : mode === "register" ? "Create your account" : "Recover your account";
  return <section className="page-shell">
    <div className="page-heading"><div className="section-kicker">DESERT ART GALLERY</div><h1>{title}</h1><p>{mode === "login" ? "Sign in to view your account and orders." : mode === "register" ? "Create an account to save pieces and manage your orders." : "We will provide a secure recovery link if the account exists."}</p></div>
    <form onSubmit={submit} className="auth-form">
      {mode === "register" && <label>Full name<input type="text" autoComplete="name" value={fullName} onChange={e=>setFullName(e.target.value)} required minLength={2} maxLength={160}/></label>}
      <label>Email address<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
      {mode !== "recover" && <label>Password<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e=>setPassword(e.target.value)} required minLength={mode === "login" ? 12 : 12}/></label>}
      <button className="button-primary dark-button" disabled={busy}>{busy ? "PLEASE WAIT…" : mode === "login" ? "SIGN IN" : mode === "register" ? "CREATE ACCOUNT" : "SEND RECOVERY LINK"}</button>
      <p className="form-message" role="status" aria-live="polite">{message}</p>
    </form>
    <div className="auth-links">
      <button onClick={()=>{setMode(mode==="login"?"recover":"login");setMessage("");}}>{mode==="login"?"Forgot your password?":"Return to sign in"}</button>
      {mode!=="recover" && <button onClick={()=>{setMode(mode==="register"?"login":"register");setMessage("");}}>{mode==="register"?"Already have an account? Sign in":"Create an account"}</button>}
      <Link href="/contact">Need help? Contact the gallery</Link>
    </div>
  </section>;
}
