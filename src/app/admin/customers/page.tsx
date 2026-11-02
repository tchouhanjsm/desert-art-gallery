import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getMySqlDb } from "@/server/db";
import { users } from "@/server/db/schema";

export const metadata={title:"Customers"};
export default async function AdminCustomersPage(){
 const rows=await getMySqlDb().select().from(users).where(eq(users.role,"customer")).orderBy(desc(users.createdAt)).limit(250);
 return <div className="page-shell">
  <div className="admin-page-heading"><div><div className="section-kicker">RELATIONSHIP MANAGEMENT</div><h1>Customers</h1><p>Customer contact details and account status.</p></div><Link className="text-link" href="/admin">DASHBOARD</Link></div>
  <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>CUSTOMER</th><th>EMAIL</th><th>PHONE</th><th>STATUS</th><th>JOINED</th></tr></thead><tbody>
   {rows.map(customer=><tr key={customer.id}><td><strong>{customer.fullName||"Customer"}</strong></td><td>{customer.email}</td><td>{customer.phone||"—"}</td><td>{customer.status}</td><td>{customer.createdAt.toLocaleDateString("en-IN")}</td></tr>)}
  </tbody></table>{!rows.length&&<div className="empty-note">No customer accounts exist yet.</div>}</div>
 </div>;
}
