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
  const [password, setパスワード] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("お客様ログインはまだ設定されていません。お問い合わせください。");
      return;
    }
    setBusy(true);
    try {
      if (mode === "recover") {
        const { error } = await supabase.auth.resetパスワードForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/account/recovery`,
        });
        if (error) throw error;
        setMessage("アカウントが存在する場合、このメールアドレスへ安全な再設定リンクを送信します。");
      } else {
        const { error } = await supabase.auth.signInWithパスワード({ email, password });
        if (error) throw error;
        window.location.assign(safeNextPath());
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "処理を完了できませんでした。もう一度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  return <section className="page-shell">
    <div className="page-heading"><div className="section-kicker">DESERT ART GALLERY</div><h1>{mode === "login" ? "お帰りなさい" : "アカウントを再設定"}</h1><p>{mode === "login" ? "アカウント情報や注文履歴を確認するにはログインしてください。" : "アカウントが存在する場合、安全な再設定リンクを送信します。"}</p></div>
    <form onSubmit={submit} className="auth-form">
      <label>メールアドレス<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
      {mode === "login" && <label>パスワード<input type="password" autoComplete="current-password" value={password} onChange={e=>setパスワード(e.target.value)} required minLength={8}/></label>}
      <button className="button-primary dark-button" disabled={busy}>{busy ? "処理しています…" : mode === "login" ? "ログイン" : "再設定リンクを送信"}</button>
      <p className="form-message" role="status" aria-live="polite">{message}</p>
    </form>
    <div className="auth-links">
      <button onClick={()=>{setMode(mode==="login"?"recover":"login");setMessage("");}}>{mode==="login"?"パスワードをお忘れですか？":"ログインに戻る"}</button>
      <Link href="/contact">お困りですか？お問い合わせください</Link>
    </div>
  </section>;
}
