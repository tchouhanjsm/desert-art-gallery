import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Content" };

export default async function AdminContentPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <div className="page-shell"><div className="page-heading"><h1>Site content</h1><p>Connect Supabase to activate content management.</p></div></div>;
  const [content, artisans, journal] = await Promise.all([
    supabase.from("site_content").select("id,content_key,title,is_published,updated_at").order("content_key"),
    supabase.from("artisan_profiles").select("id,is_published", { count: "exact", head: true }),
    supabase.from("journal_posts").select("id,status", { count: "exact", head: true }),
  ]);
  if (content.error || artisans.error || journal.error) throw new Error("Unable to load content workspace.");
  return <div className="page-shell">
    <div className="admin-page-heading"><div><div className="section-kicker">EDITORIAL WORKSPACE</div><h1>Site content</h1><p>Review publication state for managed brand content.</p></div><Link className="text-link" href="/admin">DASHBOARD</Link></div>
    <div className="admin-metrics">
      <div className="admin-metric"><span>Artisan profiles</span><strong>{artisans.count ?? 0}</strong></div>
      <div className="admin-metric"><span>Journal posts</span><strong>{journal.count ?? 0}</strong></div>
      <div className="admin-metric"><span>Content records</span><strong>{content.data?.length ?? 0}</strong></div>
    </div>
    <div className="admin-content-links"><Link href="/artisans">VIEW PUBLIC MAKER PAGE ↗</Link><Link href="/journal">VIEW PUBLIC JOURNAL ↗</Link></div>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>CONTENT KEY</th><th>TITLE</th><th>STATUS</th><th>UPDATED</th></tr></thead><tbody>
      {(content.data ?? []).map((entry) => <tr key={entry.id}><td>{entry.content_key}</td><td>{entry.title || "—"}</td><td><span className={"admin-status " + (entry.is_published ? "status-active" : "status-draft")}>{entry.is_published ? "published" : "draft"}</span></td><td>{new Date(entry.updated_at).toLocaleDateString("en-IN")}</td></tr>)}
    </tbody></table>{!(content.data ?? []).length && <div className="empty-note">No site content records have been created yet.</div>}</div>
  </div>;
}
