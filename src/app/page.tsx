import Link from "next/link";
import Image from "next/image";
import { StorefrontProductCard } from "@/components/StorefrontProductCard";
import { getStorefrontCollections, getStorefrontProducts } from "@/lib/catalogue";
import { selectStorefrontHeroProduct } from "@/lib/storefront-presentation";

export const metadata = {
  title: "Textiles and Handcrafted Objects from Rajasthan",
  description: "Explore distinctive textiles and handcrafted objects from Jaisalmer, Rajasthan, India, with clear product details and stories rooted in their place of origin.",
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
          <h1 id="home-heading">Textiles and handcrafted objects, <em>chosen for everyday living.</em></h1>
          <p>
            Based in Jaisalmer, Rajasthan, India, we bring together textiles and handcrafted pieces
            chosen for their individual character, materiality and place in everyday life.
          </p>
          <div className="jp-home-hero-actions">
            <Link className="button-primary" href="/shop" >Shop the collection</Link>
            <Link className="text-link" href="/story" >Our story</Link>
          </div>
          <p className="jp-home-hero-note">We publish each piece only after its product details, imagery and availability have been checked.</p>
        </div>
        <div className="jp-home-hero-media">
          {heroProduct ? (
            <Link href={"/products/" + heroProduct.slug} aria-label={heroProduct.name + " — View product"}>
              <Image
                src={heroProduct.image}
                alt={heroProduct.imageAlt || heroProduct.name}
                fill
                priority
                sizes="(max-width: 760px) 100vw, 46vw"
              />
              <span className="jp-home-hero-product">
                <small>FEATURED IN THE SHOP</small>
                <strong>{heroProduct.name}</strong>
              </span>
            </Link>
          ) : (
            <div className="jp-home-hero-empty">
              <span>CATALOGUE PREVIEW · DETAILS IN PROGRESS</span>
              <strong>We are preparing the shop with verified product information and photography.</strong>
              <small>Products will appear as their details are confirmed.</small>
            </div>
          )}
        </div>
      </section>

      <section className="jp-home-utility-strip" aria-label="Shopping information">
        <div><span aria-hidden="true">01</span><div><b>Product details checked</b><small>We share the information available for each individual piece.</small></div></div>
        <div><span aria-hidden="true">02</span><div><b>Photography and usage checked</b><small>Only approved images are published.</small></div></div>
        <div><span aria-hidden="true">03</span><div><b>Questions about a piece</b><small>Contact the gallery with questions before placing an order.</small></div></div>
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
              <div className="section-kicker">THE ONLINE COLLECTION</div>
              <h2 id="catalogue-heading" className="section-title">Explore the collection</h2>
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
              <h3>The collection is taking shape</h3>
              <p>Products will be listed here as their information and photography are confirmed. Contact the gallery with an enquiry in the meantime.</p>
              <Link href="/contact" className="button-outline">Contact the gallery</Link>
            </div>
          )}
        </div>
      </section>

      <section className="jp-home-story" aria-labelledby="home-story-heading">
        <div className="jp-home-story-copy">
          <div className="section-kicker">ABOUT DESERT ART GALLERY</div>
          <h2 id="home-story-heading" className="section-title">Every piece has a story, <em>worth discovering.</em></h2>
          <p>
            Desert Art Gallery is an online collection based in Jaisalmer, Rajasthan, India.
            We present each piece with care, sharing its character and the information we can verify.
          </p>
          <Link href="/story" className="text-link">Discover our story</Link>
        </div>
        <div className="jp-home-story-art" role="img" aria-label="Desert Art Gallery brand panel">
          <span>DAG</span>
        </div>
      </section>
    </div>
  );
}
