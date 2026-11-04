import Link from "next/link";
import { isMySqlCustomerAuthEnabled } from "@/server/auth/local-customer";
import { CustomerRegisterForm } from "./customer-register-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "アカウント登録", description: "Desert Art Galleryの会員登録。" };

export default function RegisterPage() {
  if (!isMySqlCustomerAuthEnabled()) {
    return <section className="page-shell"><div className="page-heading"><div className="section-kicker">お客様アカウント</div><h1>アカウント登録</h1><p>この環境ではお客様の新規登録を利用できません。</p></div><Link className="text-link" href="/login">ログインに戻る</Link></section>;
  }
  return <CustomerRegisterForm />;
}
