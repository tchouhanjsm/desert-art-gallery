"use client";
import Image from "next/image";
import { galleryBlurDataUrl } from "@/lib/image";
import Link from "next/link";
import { formatMoneyFromMinor } from "@/lib/money";
import { useCart } from "@/components/CartProvider";
import { cartLineKey } from "@/lib/cart";

export function CartPageClient() {
  const { lines, preview, isLoading, error, removeItem, setQuantity } = useCart();
  const totals: Record<string, number> = {};
  for (const item of preview) {
    if (item.priceMinor !== null && item.currency) totals[item.currency] = (totals[item.currency] ?? 0) + item.priceMinor * item.quantityRequested;
  }
  const canContinue = !isLoading && !error && lines.length > 0 && preview.length === lines.length
    && preview.every((item) => item.available && item.priceMinor !== null && Boolean(item.currency))
    && Object.keys(totals).length === 1;
  if (!lines.length) return <div className="empty-note">カートは空です。<br/><Link href="/shop" className="empty-link">商品を見る</Link></div>;
  return <div className="cart-page-layout">
    <section className="cart-page-lines">
      {isLoading && <p className="cart-state">商品情報と在庫を確認しています…</p>}
      {error && <p className="cart-error" role="status">{error}</p>}
      {preview.map((item) => <article className="cart-page-line" key={cartLineKey(item.slug, item.variantId ?? undefined)}>
        {item.image ? <Image placeholder="blur" blurDataURL={galleryBlurDataUrl} src={item.image} alt={item.imageAlt} width={160} height={210} /> : <div className="cart-line-placeholder" />}
        <div className="cart-line-details"><div className="section-kicker">DESERT ART GALLERY</div><h2>{item.name}</h2>
          <p>{item.priceMinor !== null && item.currency ? formatMoneyFromMinor(item.priceMinor, item.currency) : "価格を確認できません"}</p>
          {item.variantLabel && <p className="cart-variant-label">{item.variantLabel}</p>}
          <div className="cart-quantity"><button aria-label="数量を1つ減らす" onClick={() => setQuantity(item.slug, item.quantityRequested - 1, item.variantId ?? undefined)}>−</button><span>{item.quantityRequested}</span><button aria-label="数量を1つ増やす" disabled={item.quantityRequested >= item.availableQuantity} onClick={() => setQuantity(item.slug, item.quantityRequested + 1, item.variantId ?? undefined)}>+</button><button className="cart-remove" onClick={() => removeItem(item.slug, item.variantId ?? undefined)}>削除</button></div>
          {!item.available && <small className="cart-error">現在の在庫は{item.availableQuantity}点です。数量を変更してください。</small>}
        </div>
      </article>)}
    </section>
    <aside className="cart-summary"><div className="section-kicker">ご注文内容</div><h2>カートの商品</h2>
      {Object.entries(totals).map(([currency, amount]) => <div className="cart-summary-row" key={currency}><span>商品小計（{currency}）</span><strong>{formatMoneyFromMinor(amount, currency)}</strong></div>)}
      <p>送料、税金、関税等はお届け先により異なります。</p>
      <div className="checkout-notice">次のステップでは、お支払い前の注文案のみを作成します。承認済みの決済サービスとWebhookの設定が完了するまで、決済は行われません。</div>
      {canContinue ? <Link href="/checkout" className="button-primary dark-button">配送先の入力へ進む</Link> : <span className="button-outline checkout-disabled" aria-disabled="true">在庫を確認してからお進みください</span>}
    </aside>
  </div>;
}
