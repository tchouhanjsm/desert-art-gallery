import Link from "next/link";
import Image from "next/image";
import { StorefrontProductCard } from "@/components/StorefrontProductCard";
import { getStorefrontCollections, getStorefrontProducts } from "@/lib/catalogue";
import { selectStorefrontHeroProduct } from "@/lib/storefront-presentation";

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
          <div className="jp-home-hero-kicker">JAISALMER · RAJASTHAN · INDIA</div>
          <h1 id="home-heading">Textiles and handmade pieces, <em>with a story to tell.</em></h1>
          <p>
            Based in Jaisalmer, Rajasthan, India, we curate pieces for everyday living, paying attention to the character of each object and the details we can verify.
          </p>
          <div className="jp-home-hero-actions">
            <Link className="button-primary" href="/shop">Explore the collection</Link>
            <Link className="text-link" href="/story">Our story</Link>
          </div>
          <p className="jp-home-hero-note">Products are added as their descriptions, photographs and availability are reviewed.</p>
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
              <small>Only verified listings will be published.</small>
            </div>
          )}
        </div>
      </section>

      <section className="jp-home-utility-strip" aria-label="Shopping promises">
        <div><span aria-hidden="true">01</span><div><b>Product details reviewed</b><small>Listings are based on information we have checked.</small></div></div>
        <div><span aria-hidden="true">02</span><div><b>Photography and permissions checked</b><small>Only approved product photography is published.</small></div></div>
        <div><span aria-hidden="true">03</span><div><b>Questions about a piece</b><small>Ask us about the details of an individual piece.</small></div></div>
      </section>

      {collections.length > 0 && (
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
              <h2 id="catalogue-heading" className="section-title">Shop the collection</h2>
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
              <h3>Catalogue in preparation</h3>
              <p>We will publish pieces here once their details and photography have been reviewed. Contact us with any questions about current availability.</p>
              <Link href="/contact" className="button-outline">Contact us</Link>
            </div>
          )}
        </div>
      </section>

      <section className="jp-home-story" aria-labelledby="home-story-heading">
        <div className="jp-home-story-copy">
          <div className="section-kicker">THE STORY BEHIND THE PIECES</div>
          <h2 id="home-story-heading" className="section-title">Chosen with care, <em>shared with context.</em></h2>
          <p>
            Desert Art Gallery is based in Jaisalmer, Rajasthan. We bring together textiles and handcrafted objects, presenting each piece with respect for its character and transparent, verified information.
          </p>
          <Link href="/story" className="text-link">Discover our story</Link>
        </div>
        <div className="jp-home-story-art" role="img" aria-label="A graphic panel featuring the Desert Art Gallery monogram">
          <span>DAG</span>
        </div>
      </section>
    </div>
  );
}
