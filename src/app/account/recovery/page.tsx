import Link from "next/link";
import { isMySqlCustomerAuthEnabled } from "@/server/auth/local-customer";
import { LegacyRecoveryForm } from "./legacy-recovery-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account recovery" };

export default function AccountRecoveryPage() {
  if (isMySqlCustomerAuthEnabled()) {
    return <section className="page-shell"><div className="page-heading"><div className="section-kicker">ACCOUNT SECURITY</div><h1>Password recovery</h1><p>Email-based password recovery is not enabled because a verified transactional email service has not yet been configured.</p></div><div className="checkout-notice">Your account remains protected by its stored password hash and expiring session. Contact the gallery for help recovering access.</div><Link className="text-link" href="/contact">CONTACT THE GALLERY</Link></section>;
  }
  return <LegacyRecoveryForm />;
}
