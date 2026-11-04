import Link from "next/link";
import { redirect } from "next/navigation";
import { isMySqlCatalogueEnabled } from "@/server/db";
import { ArrowUpRight, Package, ShoppingBag, Users, Image as ImageIcon, AlertCircle, Clock3 } from "lucide-react";
import { formatMoneyFromMinor } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentLocalAdmin } from "@/server/auth/local-admin";
import { getMySqlAdminDashboard } from "@/server/admin/mysql-dashboard";

export const metadata = { title: "Overview" };

async function countRows(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  table: "products" | "orders" | "profiles",
  status?: string,
) {
  let query = client.from(table).select("*", { count: "exact", head: true });
  if (status) query = query.eq("status", status);
  const { count, error } = await query;
  return error ? null : count ?? 0;
}

function MetricCard({
  label,
  value,
  detail,
  href,
  icon: Icon,
}: {
  label: string;
  value: number | null;
  detail: string;
  href: string;
  icon: typeof Package;
}) {
  return (
    <Link className="owner-metric-card" href={href}>
      <span className="owner-metric-icon"><Icon size={19} strokeWidth={1.7} /></span>
      <span className="owner-metric-label">{label}</span>
      <strong>{value === null ? "—" : value.toLocaleString("en-IN")}</strong>
      <span className="owner-metric-detail">{detail}</span>
      <ArrowUpRight className="owner-metric-arrow" size={17} />
    </Link>
  );
}

export default async function AdminDashboardPage() {
  if (isMySqlCatalogueEnabled()) {
    const admin = await getCurrentLocalAdmin();
    if (!admin) redirect("/owner/login?next=/admin");
    const dashboard = await getMySqlAdminDashboard();
    const workspaceLabel = process.env.APP_ENV?.trim().toLowerCase() === "staging"
      ? "STAGING WORKSPACE"
      : process.env.NODE_ENV === "production" ? "PRODUCTION WORKSPACE" : "LOCAL WORKSPACE";
    const firstName = admin.displayName.trim().split(/\\s+/)[0] || "there";
    const dateFormat = new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeZone: "Asia/Kolkata",
    });

    return (
      <section className="owner-page">
        <div className="owner-page-heading owner-dashboard-heading">
          <div>
            <span className="owner-eyebrow">{workspaceLabel} · JAISALMER</span>
            <h1>Good day, {firstName}.</h1>
            <p>Your MySQL gallery workspace at a glance. This environment does not process live payments.</p>
          </div>
          <Link className="owner-primary-action" href="/admin/products/new"><Package size={17} /> Add a product</Link>
        </div>

        <div className="owner-inline-warning" role="status">
          <AlertCircle size={16} />
          Checkout is currently limited to order drafts. Payment-provider integration and verified payment webhooks are not enabled.
        </div>

        <div className="owner-metrics-grid">
          <MetricCard label="All products" value={dashboard.totalProducts} detail="Catalogue records" href="/admin/products" icon={Package} />
          <MetricCard label="Published" value={dashboard.publishedProducts} detail="Visible in the shop" href="/admin/products" icon={ImageIcon} />
          <MetricCard label="Drafts" value={dashboard.draftProducts} detail="Waiting for review" href="/admin/products" icon={Clock3} />
          <MetricCard label="Orders to review" value={dashboard.ordersNeedingAttention} detail="Draft, payment or fulfilment attention" href="/admin/orders" icon={ShoppingBag} />
          <MetricCard label="Images awaiting rights" value={dashboard.imagesAwaitingRights} detail={dashboard.totalProductImages + " product images recorded"} href="/admin/media" icon={AlertCircle} />
        </div>

        <div className="owner-dashboard-grid">
          <section className="owner-panel">
            <div className="owner-panel-heading">
              <div><span className="owner-eyebrow">LATEST ACTIVITY</span><h2>Recent orders</h2></div>
              <Link href="/admin/orders">All orders <ArrowUpRight size={15} /></Link>
            </div>
            {dashboard.recentOrders.length ? (
              <div className="owner-order-list">
                {dashboard.recentOrders.map((order) => (
                  <Link className="owner-order-row" href={"/admin/orders/" + order.id} key={order.id}>
                    <span className="owner-order-symbol"><ShoppingBag size={16} /></span>
                    <span className="owner-order-main"><strong>{order.orderNumber}</strong><small>{order.email}</small></span>
                    <span className={"owner-status owner-status-" + order.status}>{order.status.replaceAll("_", " ")}</span>
                    <strong className="owner-order-total">{formatMoneyFromMinor(order.totalMinor, order.currency)}</strong>
                  </Link>
                ))}
              </div>
            ) : <div className="owner-panel-empty"><ShoppingBag size={22} /><strong>No orders yet</strong><p>Customer checkout drafts will appear here. Payment is not enabled.</p></div>}
          </section>

          <section className="owner-panel">
            <div className="owner-panel-heading">
              <div><span className="owner-eyebrow">INVENTORY WATCH</span><h2>Low stock</h2></div>
              <Link href="/admin/products">Catalogue <ArrowUpRight size={15} /></Link>
            </div>
            {dashboard.lowStockProducts.length ? (
              <div className="owner-low-stock-list">
                {dashboard.lowStockProducts.map((product) => (
                  <Link href={"/admin/products/" + product.id} key={product.id}>
                    <span><strong>{product.title}</strong><small>/{product.slug}</small></span>
                    <b>{product.stockQuantity} left</b>
                  </Link>
                ))}
              </div>
            ) : <div className="owner-panel-empty"><Package size={22} /><strong>No low-stock products</strong><p>Published products with three or fewer active-variant units are flagged here.</p></div>}
          </section>
        </div>

        <section className="owner-panel owner-recent-products">
          <div className="owner-panel-heading">
            <div><span className="owner-eyebrow">CATALOGUE MANAGEMENT</span><h2>Recently updated products</h2></div>
            <Link href="/admin/products">Manage products <ArrowUpRight size={15} /></Link>
          </div>
          {dashboard.recentProducts.length ? (
            <div className="owner-product-table-wrap">
              <table className="owner-product-table">
                <thead><tr><th>PRODUCT</th><th>STATUS</th><th>PRICE</th><th>STOCK</th><th>UPDATED</th><th /></tr></thead>
                <tbody>{dashboard.recentProducts.map((product) => (
                  <tr key={product.id}>
                    <td><strong>{product.title}</strong><small>/{product.slug}</small></td>
                    <td><span className={"owner-status owner-status-" + product.status}>{product.status}</span></td>
                    <td>{formatMoneyFromMinor(product.priceMinor, product.currency)}</td>
                    <td>{product.stockQuantity}</td>
                    <td>{dateFormat.format(new Date(product.updatedAt))}</td>
                    <td><Link href={"/admin/products/" + product.id}>Edit ↗</Link></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <div className="owner-panel-empty"><Package size={22} /><strong>Your catalogue is ready</strong><p>Create your first draft product to begin building the online gallery.</p><Link className="owner-text-action" href="/admin/products/new">Create a product ↗</Link></div>}
        </section>

        <section className="owner-quick-actions">
          <Link href="/admin/products/new"><Package size={17} /> Create product <ArrowUpRight size={16} /></Link>
          <Link href="/admin/media"><ImageIcon size={17} /> Review photographs <ArrowUpRight size={16} /></Link>
          <Link href="/admin/orders"><ShoppingBag size={17} /> Review orders <ArrowUpRight size={16} /></Link>
          <Link href="/admin/checkout"><Clock3 size={17} /> Shipping & tax settings <ArrowUpRight size={16} /></Link>
        </section>
        <p className="owner-dashboard-footnote">
          {dashboard.archivedProducts.toLocaleString("en-IN")} archived products · {dashboard.totalCustomers.toLocaleString("en-IN")} customer accounts.
          Customer administration and the full editorial CMS are separate MySQL migration milestones.
        </p>
      </section>
    );
  }
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <section className="owner-page">
        <div className="owner-page-heading">
          <div><span className="owner-eyebrow">YOUR BUSINESS</span><h1>Good day.</h1><p>Your gallery workspace is ready for its database connection.</p></div>
        </div>
        <div className="owner-setup-card">
          <div className="owner-setup-icon"><AlertCircle size={22} /></div>
          <div><h2>Connect the catalogue</h2><p>Add the Supabase environment configuration to activate live products, media and order data. This preview does not contain live business records.</p></div>
        </div>
        <div className="owner-quick-actions">
          <Link href="/admin/products/new"><Package size={17} /> Create a product <ArrowUpRight size={16} /></Link>
          <Link href="/admin/media"><ImageIcon size={17} /> Open media library <ArrowUpRight size={16} /></Link>
          <Link href="/admin/content"><PanelsTopLeftFallback /> Manage site content <ArrowUpRight size={16} /></Link>
        </div>
      </section>
    );
  }

  const [
    totalProducts,
    activeProducts,
    draftProducts,
    ordersToReview,
    customers,
    recentOrdersResult,
    recentProductsResult,
    lowStockResult,
  ] = await Promise.all([
    countRows(supabase, "products"),
    countRows(supabase, "products", "active"),
    countRows(supabase, "products", "draft"),
    supabase.from("orders").select("*", { count: "exact", head: true }).in("status", ["pending_payment", "paid", "processing"]).then(({ count, error }) => error ? null : count ?? 0),
    countRows(supabase, "profiles"),
    supabase.from("orders").select("id,order_number,email,status,currency,total_minor,created_at").order("created_at", { ascending: false }).limit(6),
    supabase.from("products").select("id,title,slug,status,price_minor,currency,quantity_on_hand,updated_at").order("updated_at", { ascending: false }).limit(5),
    supabase.from("products").select("id,title,slug,quantity_on_hand").eq("status", "active").lte("quantity_on_hand", 3).order("quantity_on_hand", { ascending: true }).limit(5),
  ]);

  const recentOrders = recentOrdersResult.data ?? [];
  const recentProducts = recentProductsResult.data ?? [];
  const lowStock = lowStockResult.data ?? [];
  const dataWarning = Boolean(recentOrdersResult.error || recentProductsResult.error || lowStockResult.error);

  return (
    <section className="owner-page">
      <div className="owner-page-heading owner-dashboard-heading">
        <div>
          <span className="owner-eyebrow">YOUR BUSINESS · JAISALMER</span>
          <h1>Good day.</h1>
          <p>Here is what is happening across your gallery today.</p>
        </div>
        <Link className="owner-primary-action" href="/admin/products/new"><Package size={17} /> Add a product</Link>
      </div>

      {dataWarning && <div className="owner-inline-warning" role="status"><AlertCircle size={16} /> Some workspace information could not be loaded. Refresh the page or check the database connection.</div>}

      <div className="owner-metrics-grid">
        <MetricCard label="All products" value={totalProducts} detail="Catalogue records" href="/admin/products" icon={Package} />
        <MetricCard label="Published" value={activeProducts} detail="Visible in the shop" href="/admin/products" icon={ImageIcon} />
        <MetricCard label="Drafts" value={draftProducts} detail="Waiting for review" href="/admin/products" icon={Clock3} />
        <MetricCard label="Orders to review" value={ordersToReview} detail="Pending, paid or processing" href="/admin/orders" icon={ShoppingBag} />
        <MetricCard label="Customers" value={customers} detail="Customer profiles" href="/admin/customers" icon={Users} />
      </div>

      <div className="owner-dashboard-grid">
        <section className="owner-panel">
          <div className="owner-panel-heading"><div><span className="owner-eyebrow">LATEST ACTIVITY</span><h2>Recent orders</h2></div><Link href="/admin/orders">All orders <ArrowUpRight size={15} /></Link></div>
          {recentOrders.length ? (
            <div className="owner-order-list">
              {recentOrders.map((order) => (
                <Link className="owner-order-row" href={"/admin/orders/" + order.id} key={order.id}>
                  <span className="owner-order-symbol"><ShoppingBag size={16} /></span>
                  <span className="owner-order-main"><strong>{order.order_number}</strong><small>{order.email}</small></span>
                  <span className={"owner-status owner-status-" + order.status}>{order.status.replaceAll("_", " ")}</span>
                  <strong className="owner-order-total">{formatMoneyFromMinor(order.total_minor, order.currency)}</strong>
                </Link>
              ))}
            </div>
          ) : <div className="owner-panel-empty"><ShoppingBag size={22} /><strong>No orders yet</strong><p>New customer orders will appear here.</p></div>}
        </section>

        <section className="owner-panel">
          <div className="owner-panel-heading"><div><span className="owner-eyebrow">INVENTORY WATCH</span><h2>Low stock</h2></div><Link href="/admin/products">Catalogue <ArrowUpRight size={15} /></Link></div>
          {lowStock.length ? (
            <div className="owner-low-stock-list">
              {lowStock.map((product) => (
                <Link href={"/admin/products/" + product.id} key={product.id}>
                  <span><strong>{product.title}</strong><small>/{product.slug}</small></span>
                  <b>{product.quantity_on_hand} left</b>
                </Link>
              ))}
            </div>
          ) : <div className="owner-panel-empty"><Package size={22} /><strong>No low-stock products</strong><p>Products with three or fewer units will be flagged here.</p></div>}
        </section>
      </div>

      <section className="owner-panel owner-recent-products">
        <div className="owner-panel-heading"><div><span className="owner-eyebrow">CATALOGUE MANAGEMENT</span><h2>Recently updated products</h2></div><Link href="/admin/products">Manage products <ArrowUpRight size={15} /></Link></div>
        {recentProducts.length ? (
          <div className="owner-product-table-wrap">
            <table className="owner-product-table">
              <thead><tr><th>PRODUCT</th><th>STATUS</th><th>PRICE</th><th>STOCK</th><th>UPDATED</th><th /></tr></thead>
              <tbody>{recentProducts.map((product) => (
                <tr key={product.id}>
                  <td><strong>{product.title}</strong><small>/{product.slug}</small></td>
                  <td><span className={"owner-status owner-status-" + product.status}>{product.status}</span></td>
                  <td>{product.price_minor === null ? "Price not set" : formatMoneyFromMinor(product.price_minor, product.currency)}</td>
                  <td>{product.quantity_on_hand}</td>
                  <td>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(product.updated_at))}</td>
                  <td><Link href={"/admin/products/" + product.id}>Edit ↗</Link></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <div className="owner-panel-empty"><Package size={22} /><strong>Your catalogue is ready</strong><p>Create your first draft product to begin building the online gallery.</p><Link className="owner-text-action" href="/admin/products/new">Create a product ↗</Link></div>}
      </section>

      <section className="owner-quick-actions">
        <Link href="/admin/products/new"><Package size={17} /> Create product <ArrowUpRight size={16} /></Link>
        <Link href="/admin/media"><ImageIcon size={17} /> Review photographs <ArrowUpRight size={16} /></Link>
        <Link href="/admin/content"><PanelsTopLeftFallback /> Manage site content <ArrowUpRight size={16} /></Link>
        <Link href="/admin/orders"><ShoppingBag size={17} /> Process orders <ArrowUpRight size={16} /></Link>
      </section>
    </section>
  );
}

function PanelsTopLeftFallback() {
  return <span className="owner-quick-icon" aria-hidden="true">▤</span>;
}
