import Link from "next/link";
import { getStorefrontProduct } from "@/lib/catalogue";
import { parseProductEnquirySlug } from "@/lib/product-enquiry";

export const metadata = {
  title: "お問い合わせ",
  description: "Desert Art Galleryへのお問い合わせ方法をご案内します。",
};

type ContactPageProps = {
  searchParams: Promise<{ product?: string | string[] }>;
};

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const params = await searchParams;
  const requestedSlug = parseProductEnquirySlug(params.product);
  const requestedProduct = requestedSlug ? await getStorefrontProduct(requestedSlug) : null;

  return (
    <div className="page-shell atelier-contact-page">
      <header className="atelier-page-heading atelier-contact-heading">
        <div className="section-kicker">お問い合わせ · JAISALMER</div>
        <h1><em>商品について</em>お問い合わせください。</h1>
        <p>掲載中の商品、素材、お届け先への配送についてのご質問は、こちらをご確認ください。ギャラリーの公式連絡先は確認後に掲載します。連絡先が掲載されるまで、商品・注文に関するお問い合わせの送信はお控えください。</p>
      </header>

      {requestedProduct && (
        <section className="atelier-enquiry-context" id="product-enquiry" aria-labelledby="enquiry-context-heading">
          <div>
            <span className="section-kicker">商品についてのお問い合わせ</span>
            <h2 id="enquiry-context-heading">{requestedProduct.name}</h2>
            <p>{requestedProduct.category || "Desert Art Gallery"} · 選択した商品情報を保持しています。</p>
          </div>
          <Link className="text-link" href={"/products/" + requestedProduct.slug}>商品ページに戻る</Link>
          <p className="atelier-enquiry-status" role="status">
            お問い合わせ内容は準備されていますが、メッセージは送信されていません。ギャラリーの公式連絡先は現在確認中です。
          </p>
        </section>
      )}

      <div className="atelier-contact-layout">
        <section className="atelier-contact-main">
          <div className="atelier-contact-card">
            <span className="atelier-contact-card-index">01 / お問い合わせ</span>
            <h2>連絡先</h2>
            <p>公式メールアドレスとお問い合わせ方法は、確認後にこちらへ掲載します。</p>
            <p className="atelier-contact-email">公式連絡先は確認中です。</p>
            <span className="atelier-contact-location">ジャイサルメール · ラージャスターン州 · インド</span>
          </div>
          <div className="atelier-contact-note">
            <span className="section-kicker">在庫について</span>
            <p>商品内容、状態、来歴、最終価格、在庫状況は、お支払い前に一点ずつご確認ください。ギャラリーから書面での確認をお受けください。</p>
          </div>
        </section>

        <aside className="atelier-contact-guide">
          <span className="section-kicker">お問い合わせの際に</span>
          <h2>次の情報をお知らせください。</h2>
          <ol>
            <li><span>01</span><div><strong>商品名</strong><p>商品名または商品ページのリンクをお知らせください。</p></div></li>
            <li><span>02</span><div><strong>お届け先</strong><p>配送に関するご質問の場合は、お届け先の市区町村と国をお知らせください。</p></div></li>
            <li><span>03</span><div><strong>ご質問内容</strong><p>素材、寸法、状態、来歴、在庫状況などについてご質問ください。</p></div></li>
          </ol>
          <div className="atelier-contact-delivery" id="delivery-enquiries">
            <h3>配送について</h3>
            <p>配送可否、送料、税金、関税、お届け目安は、お届け先と確定した注文内容によって異なります。このページでは送料やお届け時期を確約していません。</p>
            <Link href="/contact#delivery-enquiries">配送に関するご案内</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
