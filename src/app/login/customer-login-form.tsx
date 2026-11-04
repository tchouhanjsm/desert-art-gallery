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
      <div className="page-heading"><div className="section-kicker">DESERT ART GALLERY</div><h1>お帰りなさい</h1><p>お気に入り商品や配送先情報を確認するにはログインしてください。</p></div>
      <form action={action} className="auth-form">
        <input type="hidden" name="next" value={next} />
        <label>メールアドレス<input name="email" type="email" autoComplete="email" maxLength={255} required /></label>
        <label>パスワード<input name="password" type="password" autoComplete="current-password" minLength={12} maxLength={256} required /></label>
        {state.error && <p className="form-message" role="alert">{state.error}</p>}
        <button className="button-primary dark-button" type="submit" disabled={pending}>{pending ? "ログインしています…" : "ログイン"}</button>
      </form>
      <div className="auth-links"><Link href="/register">アカウントを作成</Link><Link href="/contact">お困りですか？お問い合わせください</Link></div>
      <p className="form-message">パスワード recovery by email is not enabled yet. Contact the gallery for assistance.</p>
    </section>
  );
}
