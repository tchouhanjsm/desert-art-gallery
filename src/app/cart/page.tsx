import { CartPageClient } from "@/components/CartPageClient";
export const metadata = { title: "ショッピングカート", description: "カートに入れた商品をご確認ください。" };
export default function CartPage() {
  return <div className="page-shell">
    <div className="page-heading"><div className="section-kicker">カート</div><h1>ショッピングカート</h1><p>ご注文前に、商品の在庫状況と内容をご確認ください。</p></div>
    <CartPageClient />
  </div>;
}