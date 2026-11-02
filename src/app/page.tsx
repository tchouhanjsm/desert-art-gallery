import Link from "next/link";
import Image from "next/image";
import { StorefrontProductCard } from "@/components/StorefrontProductCard";
import { getStorefrontCollections, getStorefrontProducts } from "@/lib/catalogue";

export default async function HomePage() {
  const [collections, products] = await Promise.all([
    getStorefrontCollections(),
    getStorefrontProducts(),
  ]);

  return (
    <div className="atelier-home">
      <section className="hero hero--atelier">
        <div className="atelier-hero-art" aria-hidden="true">
          <span className="atelier-hero-art-mark">DAG</span>
          <span className="atelier-hero-art-caption">DESERT / 26</span>
        </div>
        <div className="hero-content atelier-hero-content">
          <div className="eyebrow">A CURATED GALLERY · JAISALMER, RAJASTHAN</div>
          <h1>Objects with <em>stories.</em><br />Textiles with <em>character.</em></h1>
          <p>Discover a considered collection of textiles and objects, presented with the detail and context each piece deserves.</p>
          <div className="atelier-hero-actions">
            <Link className="button-primary" href="/shop">Explore the collection <span aria-hidden="true">↗</span></Link>
            <Link className="atelier-hero-secondary" href="/story">Our story <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="atelier-hero-foot">
            <span>DESERT ART GALLERY</span>
            <span>JAISALMER · RAJASTHAN · INDIA</span>
          </div>
        </div>
        <div className="atelier-hero-stamp" aria-hidden="true">
          <span>TEXTILES</span><i>✳</i><span>OBJECTS</span><i>✳</i><span>STORIES</span>
        </div>
      </section>

      <div className="atelier-note-bar" aria-label="Gallery information">
        <span>BASED IN JAISALMER, RAJASTHAN</span>
        <span>TEXTILES · OBJECTS · STORIES</span>
        <Link href="/contact">SPEAK WITH THE GALLERY ↗</Link>
      </div>

      <section className="atelier-intro">
        <div className="atelier-intro-art">
          <div className="atelier-intro-artwork" role="img" aria-label="Abstract textile-inspired design study, not a product photograph">
            <span className="atelier-intro-artwork-mark">D</span>
            <span className="atelier-intro-artwork-caption">MATERIAL STUDY / 01</span>
          </div>
          <span className="atelier-art-index">A DESIGN STUDY · NOT PRODUCT PHOTOGRAPHY</span>
        </div>
        <div className="atelier-intro-copy">
          <div className="section-kicker">THE GALLERY&apos;S POINT OF VIEW</div>
          <h2 className="section-title">A slower way to discover <em>objects.</em></h2>
          <p>Based in Jaisalmer, Desert Art Gallery brings textiles and objects into focus through considered presentation, clear details and the stories that can be responsibly shared.</p>
          <p>Every listing should help you understand the piece before you enquire. Where information is still being confirmed, we say so clearly.</p>
          <Link className="text-link" href="/story">Discover the gallery <span aria-hidden="true">↗</span></Link>
        </div>
      </section>

      {collections.length > 0 && (
        <section className="atelier-collections">
          <div className="atelier-section-heading">
            <div>
              <div className="section-kicker">CURATED PATHS THROUGH THE GALLERY</div>
              <h2 className="section-title">Find your <em>starting point.</em></h2>
            </div>
            <Link className="text-link" href="/shop">View all pieces <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="atelier-collection-grid">
            {collections.slice(0, 4).map((item, index) => (
              <Link
                className={"atelier-collection-card atelier-collection-card-" + (index + 1)}
                href={"/collections/" + item.slug}
                key={item.slug}
              >
                <div className="atelier-collection-image">
                  {item.image === "/images/textile-placeholder.svg" ? (
                    <div className={"atelier-collection-placeholder atelier-collection-placeholder--" + (index + 1)} aria-hidden="true">
                      <span>0{index + 1}</span><strong>{item.name}</strong><i>GALLERY COLLECTION</i>
                    </div>
                  ) : (
                    <Image src={item.image} alt="" fill sizes="(max-width: 760px) 75vw, 25vw" unoptimized />
                  )}
                  <span className="atelier-collection-arrow" aria-hidden="true">↗</span>
                </div>
                <div className="atelier-collection-copy">
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="atelier-featured">
        <div className="atelier-section-heading atelier-featured-heading">
          <div>
            <div className="section-kicker">SELECTED FROM THE ONLINE CATALOGUE</div>
            <h2 className="section-title">{products.length > 0 ? <>Pieces to <em>discover.</em></> : <>The catalogue is being <em>prepared.</em></>}</h2>
            <p>{products.length > 0 ? "Explore the pieces currently published by the gallery." : "New pieces will appear as their descriptions and image permissions are confirmed."}</p>
          </div>
          {products.length > 0 && <Link className="text-link" href="/shop">Browse the catalogue <span aria-hidden="true">↗</span></Link>}
        </div>
        {products.length > 0 ? (
          <div className="atelier-product-grid">
            {products.slice(0, 8).map((product) => (
              <StorefrontProductCard key={product.slug} product={product} />
            ))}
          </div>
        ) : (
          <div className="atelier-empty-catalogue">
            <span className="atelier-empty-mark" aria-hidden="true">✳</span>
            <h3>A new collection is taking shape.</h3>
            <p>Contact the gallery for current availability and product enquiries.</p>
            <Link className="button-outline" href="/contact">Contact the gallery</Link>
          </div>
        )}
      </section>

      <section className="atelier-story">
        <div className="atelier-story-mark" aria-hidden="true">DAG<br /><span>JAISALMER</span></div>
        <div className="atelier-story-copy">
          <div className="section-kicker">A GALLERY ROOTED IN PLACE</div>
          <h2 className="section-title">A place for <em>material,</em><br />meaning and discovery.</h2>
          <p>Explore the gallery&apos;s approach to textiles, objects and the care taken when presenting the people and processes connected to them.</p>
          <Link className="atelier-light-link" href="/story">Read our story <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="atelier-story-image" role="img" aria-label="Abstract gallery design study, not product photography">
          <div className="atelier-story-image-art" aria-hidden="true"><span>D</span></div>
          <span>DESIGN STUDY · ORIGINAL PHOTOGRAPHY TO FOLLOW</span>
        </div>
      </section>

      <section className="atelier-values" aria-label="Our approach">
        <div className="atelier-value">
          <span>01</span>
          <h3>Clear details</h3>
          <p>Product information is presented as it is supplied and verified.</p>
        </div>
        <div className="atelier-value">
          <span>02</span>
          <h3>Considered stories</h3>
          <p>Images and personal stories are shared with appropriate permission.</p>
        </div>
        <div className="atelier-value">
          <span>03</span>
          <h3>Direct conversation</h3>
          <p>Ask the gallery for clarification on a piece before making a decision.</p>
        </div>
      </section>

      <section className="atelier-contact">
        <div className="section-kicker">A QUESTION ABOUT A PIECE?</div>
        <h2>Some things are better <em>discovered together.</em></h2>
        <p>For product details, availability or delivery questions, start a conversation with the gallery.</p>
        <Link className="button-primary" href="/contact">Contact the gallery <span aria-hidden="true">↗</span></Link>
      </section>
    </div>
  );
}
