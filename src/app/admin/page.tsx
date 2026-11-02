import Link from "next/link";
import { ArrowUpRight, Package, ShoppingBag, Users, Image as ImageIcon, Clock3 } from "lucide-react";
import { and, count, desc, eq, lte, inArray } from "drizzle-orm";
import { formatMoneyFromMinor } from "@/lib/money";
import { getMySqlDb } from "@/server/db";
import { orders, products, users } from "@/server/db/schema";

export const metadata={title:"Overview"};
function MetricCard({label,value,detail,href,icon:Icon}:{label:string;value:number;detail:string;href:string;icon:typeof Package}){
 return <Link className="owner-metric-card" href={href}><span className="owner-metric-icon"><Icon size={19} strokeWidth={1.7}/></span><span className="owner-metric-label">{label}</span><strong>{value.toLocaleString("en-IN")}</strong><span className="owner-metric-detail">{detail}</span><ArrowUpRight className="owner-metric-arrow" size={17}/></Link>;
}
export default async function AdminDashboardPage(){
 const db=getMySqlDb();
 const [total,active,drafts,review,customerCount,recentOrderRows,recentProductRows,lowStockRows]=await Promise.all([
  db.select({value:count()}).from(products),
  db.select({value:count()}).from(products).where(eq(products.status,"active")),
  db.select({value:count()}).from(products).where(eq(products.status,"draft")),
  db.select({value:count()}).from(orders).where(inArray(orders.status,["pending_payment","paid","processing"])),
  db.select({value:count()}).from(users).where(eq(users.role,"customer")),
  db.select().from(orders).orderBy(desc(orders.createdAt)).limit(6),
  db.select().from(products).orderBy(desc(products.updatedAt)).limit(5),
  db.select().from(products).where(and(eq(products.status,"active"),lte(products.quantityOnHand,3))).orderBy(products.quantityOnHand).limit(5),
 ]);
 const recentOrders=recentOrderRows;
 const recentProducts=recentProductRows;
 const lowStock=lowStockRows;
 return <section className="owner-page">
  <div className="owner-page-heading owner-dashboard-heading"><div><span className="owner-eyebrow">YOUR BUSINESS · JAISALMER</span><h1>Good day.</h1><p>Here is what is happening across your gallery today.</p></div><Link className="owner-primary-action" href="/admin/products/new"><Package size={17}/> Add a product</Link></div>
  <div className="owner-metrics-grid">
   <MetricCard label="All products" value={total[0]?.value??0} detail="Catalogue records" href="/admin/products" icon={Package}/>
   <MetricCard label="Published" value={active[0]?.value??0} detail="Visible in the shop" href="/admin/products" icon={ImageIcon}/>
   <MetricCard label="Drafts" value={drafts[0]?.value??0} detail="Waiting for review" href="/admin/products" icon={Clock3}/>
   <MetricCard label="Orders to review" value={review[0]?.value??0} detail="Pending, paid or processing" href="/admin/orders" icon={ShoppingBag}/>
   <MetricCard label="Customers" value={customerCount[0]?.value??0} detail="Customer accounts" href="/admin/customers" icon={Users}/>
  </div>
  <div className="owner-dashboard-grid">
   <section className="owner-panel"><div className="owner-panel-heading"><div><span className="owner-eyebrow">LATEST ACTIVITY</span><h2>Recent orders</h2></div><Link href="/admin/orders">All orders <ArrowUpRight size={15}/></Link></div>
    {recentOrders.length?<div className="owner-order-list">{recentOrders.map(order=><Link className="owner-order-row" href={"/admin/orders/"+order.id} key={order.id}><span className="owner-order-symbol"><ShoppingBag size={16}/></span><span className="owner-order-main"><strong>{order.orderNumber}</strong><small>{order.email}</small></span><span className={"owner-status owner-status-"+order.status}>{order.status.replaceAll("_"," ")}</span><strong className="owner-order-total">{formatMoneyFromMinor(order.totalMinor,order.currency)}</strong></Link>)}</div>:<div className="owner-panel-empty"><ShoppingBag size={22}/><strong>No orders yet</strong><p>New customer orders will appear here.</p></div>}
   </section>
   <section className="owner-panel"><div className="owner-panel-heading"><div><span className="owner-eyebrow">INVENTORY WATCH</span><h2>Low stock</h2></div><Link href="/admin/products">Catalogue <ArrowUpRight size={15}/></Link></div>
    {lowStock.length?<div className="owner-low-stock-list">{lowStock.map(product=><Link href={"/admin/products/"+product.id} key={product.id}><span><strong>{product.title}</strong><small>/{product.slug}</small></span><b>{product.quantityOnHand} left</b></Link>)}</div>:<div className="owner-panel-empty"><Package size={22}/><strong>No low-stock products</strong><p>Products with three or fewer units will be flagged here.</p></div>}
   </section>
  </div>
  <section className="owner-panel owner-recent-products"><div className="owner-panel-heading"><div><span className="owner-eyebrow">CATALOGUE MANAGEMENT</span><h2>Recently updated products</h2></div><Link href="/admin/products">Manage products <ArrowUpRight size={15}/></Link></div>
   {recentProducts.length?<div className="owner-product-table-wrap"><table className="owner-product-table"><thead><tr><th>PRODUCT</th><th>STATUS</th><th>PRICE</th><th>STOCK</th><th>UPDATED</th><th/></tr></thead><tbody>{recentProducts.map(product=><tr key={product.id}><td><strong>{product.title}</strong><small>/{product.slug}</small></td><td><span className={"owner-status owner-status-"+product.status}>{product.status}</span></td><td>{product.priceMinor===null?"Price not set":formatMoneyFromMinor(product.priceMinor,product.currency)}</td><td>{product.quantityOnHand}</td><td>{new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeZone:"Asia/Kolkata"}).format(product.updatedAt)}</td><td><Link href={"/admin/products/"+product.id}>Edit ↗</Link></td></tr>)}</tbody></table></div>:<div className="owner-panel-empty"><Package size={22}/><strong>Your catalogue is ready</strong><p>Create your first draft product to begin building the online gallery.</p><Link className="owner-text-action" href="/admin/products/new">Create a product ↗</Link></div>}
  </section>
  <section className="owner-quick-actions">
   <Link href="/admin/products/new"><Package size={17}/> Create product <ArrowUpRight size={16}/></Link>
   <Link href="/admin/media"><ImageIcon size={17}/> Review photographs <ArrowUpRight size={16}/></Link>
   <Link href="/admin/content"><span className="owner-quick-icon" aria-hidden="true">▤</span> Manage site content <ArrowUpRight size={16}/></Link>
   <Link href="/admin/orders"><ShoppingBag size={17}/> Process orders <ArrowUpRight size={16}/></Link>
  </section>
 </section>;
}
