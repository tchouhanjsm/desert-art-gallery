import Link from "next/link";
import Image from "next/image";
import { StorefrontProductCard } from "@/components/StorefrontProductCard";
import { getStorefrontCollections, getStorefrontProducts } from "@/lib/catalogue";
import { isPublishedCollectionImage, selectStorefrontHeroProduct } from "@/lib/storefront-presentation";

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

  return (
    <div className="jp-home">
      <section className="jp-home-hero" aria-labelledby="home-heading">
        <div className="jp-home-hero-copy">
          <div className="jp-home-hero-kicker">DESERT ART GALLERY · Jaisalmer, Rajasthan</div>
          <h1 id="home-heading">Distinctive textiles.<br /><em>Considered pieces for living.</em></h1>
          <p>
            Explore a considered selection of heritage textiles and handcrafted objects, each presented with the product details we can verify.
          </p>
          <div className="jp-home-hero-actions">
            <Link className="button-primary" href="/shop">Shop all products</Link>
            <Link className="text-link" href="/story">Browse categories</Link>
          </div>
          
        </div>
        <div className="jp-home-hero-media">
          {heroProduct ? (
            <Link href={"/products/" + heroProduct.slug} aria-label={heroProduct.name + " — view product details"}>
              <Image
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
              <strong>We are preparing the catalogue while product details and photography are reviewed.</strong>
              <small>Listings appear only after product details, media and rights checks are complete.</small>
            </div>
          )}
        </div>
      </section>

      <section className="jp-home-utility-strip" aria-label="Shopping information">
        <div><span aria-hidden="true">01</span><div><b>Know what you are buying</b><small>Product descriptions and specifications are shown when verified.</small></div></div>
        <div><span aria-hidden="true">02</span><div><b>Thoughtful image selection</b><small>Product photography is reviewed for accuracy and usage rights.</small></div></div>
        <div><span aria-hidden="true">03</span><div><b>Clear before you order</b><small>Ask us to confirm price, availability and delivery details.</small></div></div>
      </section>

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

      <section className="jp-home-story" aria-labelledby="home-story-heading">
        <div className="jp-home-story-copy">
          <div className="section-kicker">THE GALLERY APPROACH</div>
          <h2 id="home-story-heading" className="section-title">A closer look at <em>craft and character.</em></h2>
          <p>
            From Jaisalmer, Rajasthan, we bring together distinctive textiles and handcrafted objects. Every listing is built around the individual piece—not generic claims.
          </p>
          <Link href="/story" className="text-link">Our approach to curation</Link>
        </div>
        <div className="jp-home-story-art jp-home-editorial-note">
          <span className="section-kicker">CURATION NOTES</span>
          <strong>Material<br />Texture<br />Provenance<br />Character</strong>
          <small>Facts are shared when verified. Nothing is guessed to fill a listing.</small>
        </div>
      </section>
    </div>
  );
}
