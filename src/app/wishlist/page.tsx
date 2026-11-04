import { WishlistPageClient } from "@/components/WishlistPageClient";
export const metadata = { title: "お気に入り", description: "気になる商品をお気に入りに保存できます。" };
export default function WishlistPage() {
  return <div className="page-shell"><div className="page-heading"><div className="section-kicker">お気に入り</div><h1>お気に入りの商品</h1><p>気になる商品をまとめて確認できます。</p></div><WishlistPageClient /></div>;
}