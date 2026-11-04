import Link from "next/link";
import Image from "next/image";
import { StorefrontProductCard } from "@/components/StorefrontProductCard";
import { getStorefrontCollections, getStorefrontProducts } from "@/lib/catalogue";
import { selectStorefrontHeroProduct } from "@/lib/storefront-presentation";

export const metadata = {
  title: "ラージャスターンのテキスタイルと手仕事",
  description: "Desert Art Galleryのオンラインストア。インド・ラージャスターン州ジャイサルメールから、テキスタイルと手仕事の品をご紹介します。",
};

export default async function HomePage() {
  const [collections, products] = await Promise.all([
    getStorefrontCollections(),
    getStorefrontProducts(),
  ]);
  const heroProduct = selectStorefrontHeroProduct(products);

  return (
    <div className="jp-home">
      <section className="jp-home-hero" aria-labelledby="home-heading">
        <div className="jp-home-hero-copy">
          <div className="jp-home-hero-kicker">DESERT ART GALLERY · JAISALMER, RAJASTHAN</div>
          <h1 id="home-heading">テキスタイルと手仕事を、<em>日々の暮らしへ。</em></h1>
          <p>
            インド・ラージャスターン州ジャイサルメールを拠点に、
            一点ずつの表情や素材感を大切にしながら、暮らしの中で楽しめる品をご紹介します。
          </p>
          <div className="jp-home-hero-actions">
            <Link className="button-primary" href="/shop">商品を見る</Link>
            <Link className="text-link" href="/story">ブランドについて</Link>
          </div>
          <p className="jp-home-hero-note">掲載内容・写真・在庫情報を確認できた商品から順次ご案内しています。</p>
        </div>
        <div className="jp-home-hero-media">
          {heroProduct ? (
            <Link href={"/products/" + heroProduct.slug} aria-label={heroProduct.name + " の商品ページを見る"}>
              <Image
                src={heroProduct.image}
                alt={heroProduct.imageAlt || heroProduct.name}
                fill
                priority
                sizes="(max-width: 760px) 100vw, 46vw"
              />
              <span className="jp-home-hero-product">
                <small>オンラインストア掲載商品</small>
                <strong>{heroProduct.name}</strong>
              </span>
            </Link>
          ) : (
            <div className="jp-home-hero-empty">
              <span>ONLINE STORE · CATALOGUE IN PREPARATION</span>
              <strong>商品写真と情報を確認しながら、オンラインストアを準備しています。</strong>
              <small>確認済みの商品から順次公開します。</small>
            </div>
          )}
        </div>
      </section>

      <section className="jp-home-utility-strip" aria-label="ご案内">
        <div><span aria-hidden="true">01</span><div><b>商品情報を確認して掲載</b><small>確認できた情報をもとにご案内します。</small></div></div>
        <div><span aria-hidden="true">02</span><div><b>写真と掲載許可を確認</b><small>確認が済んだ写真のみ公開します。</small></div></div>
        <div><span aria-hidden="true">03</span><div><b>商品についてのお問い合わせ</b><small>気になる点は商品ごとにご相談ください。</small></div></div>
      </section>

      {collections.length > 0 && (
        <section className="jp-home-section jp-home-section--muted" aria-labelledby="collections-heading">
          <div className="jp-home-section-inner">
            <div className="jp-home-section-heading">
              <div>
                <div className="section-kicker">CURATED COLLECTIONS</div>
                <h2 id="collections-heading" className="section-title">コレクションから探す</h2>
              </div>
              <Link href="/shop" className="text-link">すべての商品を見る</Link>
            </div>
            <div className="jp-home-collection-grid">
              {collections.slice(0, 4).map((collection) => (
                <Link className="jp-home-collection-card" href={"/collections/" + collection.slug} key={collection.slug}>
                  <div className="jp-home-collection-media">
                    <Image
                      src={collection.image}
                      alt={collection.imageAlt || collection.name}
                      fill
                      sizes="(max-width: 760px) 46vw, 24vw"
                    />
                  </div>
                  <h3>{collection.name}</h3>
                  <p>{collection.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="jp-home-section" aria-labelledby="catalogue-heading">
        <div className="jp-home-section-inner">
          <div className="jp-home-section-heading">
            <div>
              <div className="section-kicker">THE ONLINE CATALOGUE</div>
              <h2 id="catalogue-heading" className="section-title">オンラインストアの商品</h2>
            </div>
            {products.length > 0 && <Link href="/shop" className="text-link">商品をもっと見る</Link>}
          </div>
          {products.length > 0 ? (
            <div className="jp-home-products">
              {products.slice(0, 8).map((product) => (
                <StorefrontProductCard key={product.slug} product={product} />
              ))}
            </div>
          ) : (
            <div className="jp-home-empty">
              <h3>商品を準備しています</h3>
              <p>商品情報と写真の確認が済み次第、こちらに掲載します。現在の取り扱いについてはお問い合わせください。</p>
              <Link href="/contact" className="button-outline">お問い合わせ</Link>
            </div>
          )}
        </div>
      </section>

      <section className="jp-home-story" aria-labelledby="home-story-heading">
        <div className="jp-home-story-copy">
          <div className="section-kicker">ABOUT DESERT ART GALLERY</div>
          <h2 id="home-story-heading" className="section-title">品物の背景まで、<em>ていねいに。</em></h2>
          <p>
            Desert Art Galleryは、ラージャスターン州ジャイサルメールを拠点とするオンラインストアです。
            商品そのものの魅力と、確認できる情報を大切にしてご紹介します。
          </p>
          <Link href="/story" className="text-link">私たちについて</Link>
        </div>
        <div className="jp-home-story-art" role="img" aria-label="Desert Art Galleryのロゴを使ったデザインパネル">
          <span>DAG</span>
        </div>
      </section>
    </div>
  );
}
