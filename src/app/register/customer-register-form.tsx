"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerCustomer, type CustomerRegistrationState } from "./actions";

const initialState: CustomerRegistrationState = {};

export function CustomerRegisterForm() {
  const [state, action, pending] = useActionState(registerCustomer, initialState);
  return (
    <section className="page-shell">
      <div className="page-heading"><div className="section-kicker">会員登録</div><h1>アカウントを作成</h1><p>お気に入り商品や配送先情報をまとめて管理できます。</p></div>
      <form action={action} className="auth-form">
        <label>お名前<input name="display_name" autoComplete="name" minLength={2} maxLength={160} required /></label>
        <label>メールアドレス<input name="email" type="email" autoComplete="email" maxLength={255} required /></label>
        <label>パスワード<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label>
        <label>パスワード（確認）<input name="password_confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label>
        {state.error && <p className="form-message" role="alert">{state.error}</p>}
        <button className="button-primary dark-button" type="submit" disabled={pending}>{pending ? "アカウントを作成しています…" : "アカウントを作成"}</button>
      </form>
      <div className="auth-links"><Link href="/login">アカウントをお持ちですか？ログイン</Link><Link href="/contact">お問い合わせ</Link></div>
      <p className="form-message">メール認証はまだ有効になっていません。利用可能なメールアドレスを入力し、パスワードを安全に管理してください。</p>
    </section>
  );
}
