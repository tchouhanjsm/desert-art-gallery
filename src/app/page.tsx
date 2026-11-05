import Link from "next/link";
import { StorefrontImage } from "@/components/StorefrontImage";
import { StorefrontProductCard } from "@/components/StorefrontProductCard";
import { getStorefrontCollections, getStorefrontProducts } from "@/lib/catalogue";
import { ALL_SHOP_CATEGORY, getShopCategories } from "@/lib/shop-query";
import { isPublishedCollectionImage, isPublishedProductRecord, selectStorefrontHeroProduct } from "@/lib/storefront-presentation";

export const metadata = {
  title: "Textiles and Handcrafted Pieces from Rajasthan",
  description: "Discover textiles and handcrafted pieces from Jaisalmer, Rajasthan, India. Each listing is presented with care for its character and the details we can verify.",
};

export default async function HomePage() {
  const [collections, products] = await Promise.all([
    getStorefrontCollections(),
    getStorefrontProducts(),
  ]);
  const heroProduct = selectStorefrontHeroProduct(products);
  const publishedCategories = getShopCategories(products.filter(isPublishedProductRecord))
    .filter((category) => category !== ALL_SHOP_CATEGORY);

  return (
    <div className="jp-home">
      <section className="jp-home-hero" aria-labelledby="home-heading">
        <div className="jp-home-hero-copy">
          <div className="jp-home-hero-kicker">A CURATED ONLINE STORE · Jaisalmer, Rajasthan</div>
          <h1 id="home-heading">Distinctive textiles.<br /><em>Considered pieces for living.</em></h1>
          <p>
            Discover distinctive textiles and handcrafted pieces, selected for their character, material and place in everyday life.
          </p>
          <div className="jp-home-hero-actions">
            <Link className="button-primary" href="/shop">Shop all products</Link>
            <Link className="text-link" href={publishedCategories.length ? "#shop-categories" : "/shop"}>
              {publishedCategories.length ? "Browse categories" : "Explore the shop"}
            </Link>
          </div>
        </div>
        <div className={heroProduct ? "jp-home-hero-media" : "jp-home-hero-media jp-home-hero-media--empty"}>
          {heroProduct ? (
            <Link href={"/products/" + heroProduct.slug} aria-label={heroProduct.name + " — view product details"}>
              <StorefrontImage
                src={heroProduct.image}
                alt={heroProduct.imageAlt || heroProduct.name}
                fill
                priority
                sizes="(max-width: 760px) 100vw, 46vw"
              />
              <span className="jp-home-hero-product">
                <small>FEATURED IN THE ONLINE STORE</small>
                <strong>{heroProduct.name}</strong>
              </span>
            </Link>
          ) : (
            <div className="jp-home-hero-empty">
              <span>ONLINE STORE · CATALOGUE IN PREPARATION</span>
              <span className="jp-hero-placeholder-index">01 / THE COLLECTION</span>
              <strong>Objects with character. Details worth discovering.</strong>
              <small>Product listings appear only after details, photography and usage rights are approved.</small>
              <div className="jp-hero-placeholder-swatches" aria-hidden="true"><i /><i /><i /></div>
            </div>
          )}
        </div>
      </section>

      <section className="jp-home-utility-strip" aria-label="Shopping information">
        <div><span aria-hidden="true">01</span><div><b>Know what you are buying</b><small>Product descriptions and specifications are shown when verified.</small></div></div>
        <div><span aria-hidden="true">02</span><div><b>Thoughtful image selection</b><small>Product photography is reviewed for accuracy and usage rights.</small></div></div>
        <div><span aria-hidden="true">03</span><div><b>Clear before you order</b><small>Ask us to confirm price, availability and delivery details.</small></div></div>
      </section>

      {publishedCategories.length > 0 && (
        <section className="jp-home-category-discovery" id="shop-categories" aria-labelledby="shop-categories-heading">
          <div className="jp-home-section-inner">
            <div className="section-kicker">SHOP BY CATEGORY</div>
            <h2 id="shop-categories-heading" className="section-title">Find a starting point</h2>
            <div className="jp-home-category-links">
              {publishedCategories.map((category) => (
                <Link className="jp-home-category-link" href={"/shop?category=" + encodeURIComponent(category)} key={category}>
                  {category}
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {collections.filter(isPublishedCollectionImage).length > 0 && (
        <section className="jp-home-section jp-home-section--muted" aria-labelledby="collections-heading">
          <div className="jp-home-section-inner">
            <div className="jp-home-section-heading">
              <div>
                <div className="section-kicker">CURATED COLLECTIONS</div>
                <h2 id="collections-heading" className="section-title">Explore by collection</h2>
              </div>
              <Link href="/shop" className="text-link">View all products</Link>
            </div>
            <div className="jp-home-collection-grid">
              {collections.filter(isPublishedCollectionImage).slice(0, 4).map((collection) => (
                <Link className="jp-home-collection-card" href={"/collections/" + collection.slug} key={collection.slug}>
                  <div className="jp-home-collection-media">
                    <StorefrontImage
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
              <div className="section-kicker">THE ONLINE COLLECTION</div>
              <h2 id="catalogue-heading" className="section-title">Shop considered pieces</h2>
            </div>
            {products.length > 0 && <Link href="/shop" className="text-link">View more products</Link>}
          </div>
          {products.length > 0 ? (
            <div className="jp-home-products">
              {products.slice(0, 8).map((product) => (
                <StorefrontProductCard key={product.slug} product={product} />
              ))}
            </div>
          ) : (
            <div className="jp-home-empty">
              <h3>The collection is being prepared with care</h3>
              <p>We are reviewing original product photography, product details and permissions before listings go live. Explore the shop or contact the gallery about a specific piece.</p>
              <Link href="/shop" className="button-outline">Explore the shop</Link>
            </div>
          )}
        </div>
      </section>

      <section className="jp-home-story jp-home-story--compact" aria-labelledby="home-story-heading">
        <div className="jp-home-story-copy">
          <div className="section-kicker">THE GALLERY APPROACH</div>
          <h2 id="home-story-heading" className="section-title">A closer look at <em>craft and character.</em></h2>
          <p>
            From Jaisalmer, Rajasthan, we bring together distinctive textiles and handcrafted objects. Every listing is built around the individual piece—not generic claims.
          </p>
          <Link href="/story" className="text-link">Our approach to curation</Link>
        </div>
      </section>
    </div>
  );
}
