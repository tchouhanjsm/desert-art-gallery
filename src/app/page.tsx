import Image from "next/image";
import Link from "next/link";
import { getStorefrontCollections, getStorefrontProducts } from "@/lib/catalogue";

export default async function HomePage() {
  const [collections, products] = await Promise.all([
    getStorefrontCollections(),
    getStorefrontProducts(),
  ]);

  return (
    <>
      <section className="hero">
        <Image className="hero-image" src="/images/textile-placeholder.svg" alt="" fill priority unoptimized sizes="100vw" />
        <div className="hero-content">
          <div className="eyebrow">A TEXTILE-LED GALLERY IN JAISALMER</div>
          <h1>TEXTILES.<br />OBJECTS.<br />STORIES.</h1>
          <p>A considered view of material, colour and making, based in Jaisalmer, Rajasthan.</p>
          <Link className="button-primary" href="/shop">EXPLORE THE SHOP</Link>
        </div>
      </section>

      <section className="intro">
        <div className="intro-image-wrap">
          <Image className="intro-image" src="/images/textile-placeholder.svg" alt="" fill sizes="(max-width:700px) 90vw, 42vw" unoptimized />
        </div>
        <div className="intro-copy">
          <div className="section-kicker">A PLACE FOR MATERIAL & MEANING</div>
          <h2 className="section-title">A closer look at cloth.</h2>
          <p>Desert Art Gallery is based in Jaisalmer, Rajasthan. We share a considered view of textiles and objects, alongside the stories and processes that surround them.</p>
          <p>Product information is published as it is verified. If you have a question about a particular piece, our gallery welcomes a direct enquiry.</p>
          <Link className="text-link" href="/story">DISCOVER OUR APPROACH ↗</Link>
        </div>
      </section>

      {collections.length > 0 && (
        <section className="collections-section">
          <div className="section-heading">
            <div className="section-kicker">EXPLORE BY COLLECTION</div>
            <h2 className="section-title">Browse the gallery</h2>
            <p>Published collections and their available details.</p>
          </div>
          <div className="collection-grid">
            {collections.map((item) => (
              <Link className="collection-card" href={"/collections/" + item.slug} key={item.slug}>
                <div className="collection-photo">
                  <Image src={item.image} alt="" fill sizes="(max-width:700px) 45vw, 25vw" unoptimized />
                </div>
                <span>{item.name}</span>
                <small>{item.description}</small>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="featured-section">
        <div className="section-heading">
          <div className="section-kicker">THE ONLINE CATALOGUE</div>
          <h2 className="section-title">{products.length > 0 ? "Published pieces" : "The catalogue is being prepared"}</h2>
          <p>{products.length > 0 ? "Explore the pieces currently published by the gallery." : "Pieces will appear here when their details and image permissions are ready."}</p>
        </div>
        {products.length > 0 ? (
          <>
            <div className="product-grid">
              {products.slice(0, 8).map((item) => (
                <article className="product-card" key={item.slug}>
                  <Link href={"/products/" + item.slug}>
                    <div className="product-image-wrap">
                      <Image src={item.image} alt={item.imageAlt} fill sizes="(max-width:700px) 48vw, 24vw" unoptimized />
                    </div>
                    <div className="product-meta">
                      <div className="product-category">{item.category}</div>
                      <h3 className="product-name">{item.name}</h3>
                      <div className="product-note">{item.note}</div>
                      <div className="product-availability">CONTACT THE GALLERY FOR DETAILS</div>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
            <div className="center-action"><Link className="button-outline" href="/shop">VIEW THE SHOP</Link></div>
          </>
        ) : (
          <div className="empty-note">
            No pieces are currently published online. Contact the gallery to ask about current availability.
            <div className="center-action"><Link className="text-link" href="/contact">CONTACT THE GALLERY ↗</Link></div>
          </div>
        )}
      </section>

      <section className="craft-section">
        <div className="craft-copy">
          <div className="section-kicker">PEOPLE & PROCESS</div>
          <h2 className="section-title">Stories, shared with care.</h2>
          <p>Maker profiles and production details belong to the people behind the work. We share them only when the individuals involved have reviewed and approved what is published.</p>
          <Link className="text-link" href="/artisans">ABOUT MAKER STORIES ↗</Link>
        </div>
      </section>

      <section className="values" aria-label="Gallery principles">
        <div className="value-item">
          <b>Clear details</b>
          <p>Product information is presented as it is verified.</p>
        </div>
        <div className="value-item">
          <b>Respectful representation</b>
          <p>Imagery and personal stories require appropriate permission.</p>
        </div>
        <div className="value-item">
          <b>Direct enquiries</b>
          <p>Ask the gallery to confirm details before making a purchase decision.</p>
        </div>
      </section>

      <section className="story-band">
        <Image src="/images/textile-placeholder.svg" alt="" width={1000} height={1200} unoptimized />
        <div className="story-copy">
          <div className="section-kicker">FROM JAISALMER, RAJASTHAN</div>
          <h2 className="section-title">A gallery with a point of view.</h2>
          <p>Explore our approach to textiles, objects and the care taken when presenting the people and processes connected to them.</p>
          <Link className="text-link" href="/story">READ OUR STORY ↗</Link>
        </div>
      </section>

      <section className="contact-band">
        <div className="section-kicker">A DIRECT CONVERSATION</div>
        <h2>Have a question?</h2>
        <p>For product details, availability or destination-specific delivery questions, contact the gallery before making payment.</p>
        <Link className="button-outline" href="/contact">CONTACT THE GALLERY</Link>
      </section>
    </>
  );
}
