import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Our approach",
  description: "The approach of Desert Art Gallery, a textile and object gallery based in Jaisalmer, Rajasthan.",
};

export default function StoryPage() {
  return (
    <div className="atelier-story-page">
      <header className="atelier-story-masthead">
        <div className="section-kicker">DESERT ART GALLERY · JAISALMER</div>
        <h1>Textiles, objects<br />and their <em>context.</em></h1>
        <p>A gallery perspective from Jaisalmer, Rajasthan.</p>
      </header>

      <figure className="atelier-story-visual">
        <Image src="/images/textile-placeholder.svg" alt="" fill sizes="100vw" unoptimized />
        <figcaption><span>VISUAL STUDY · TEXTILE PATTERN</span><span>DESIGN PLACEHOLDER · NOT PRODUCT PHOTOGRAPHY</span></figcaption>
      </figure>

      <div className="atelier-story-content">
        <article className="atelier-story-article">
          <span className="section-kicker">THE GALLERY&apos;S APPROACH</span>
          <h2>Look closely.<br /><em>Understand the piece.</em></h2>
          <p>Desert Art Gallery is based in Jaisalmer, Rajasthan. Our focus is the visual language of textiles and objects, and the context that helps people understand what they are considering.</p>
          <p>Every published product should be accompanied by the information the gallery can verify. Materials, measurements, condition, provenance and availability are not assumed; they are confirmed piece by piece.</p>

          <h3>Respect for the people behind the work</h3>
          <p>Craft is knowledge, time and work carried by people and communities. Maker names, biographies, portraits and production details should appear only after the people involved have reviewed and approved their use.</p>

          <h3>A considered conversation</h3>
          <p>If you are interested in a piece, contact the gallery with its name or link and your destination country. Please wait for written confirmation of the item details, final price and delivery charges before sending payment.</p>
        </article>

        <aside className="atelier-story-aside">
          <div className="atelier-story-aside-mark">DAG</div>
          <span>BASED IN</span>
          <strong>Jaisalmer</strong>
          <span>RAJASTHAN · INDIA</span>
          <div className="atelier-story-aside-rule" />
          <p>Textiles. Objects. Stories.</p>
          <Link className="text-link" href="/shop">Explore the gallery ↗</Link>
        </aside>
      </div>

      <section className="atelier-story-close">
        <span className="section-kicker">A DIRECT CONVERSATION</span>
        <h2>Have a piece in mind?</h2>
        <p>Send the gallery the name or link and your question. We will help confirm the details available.</p>
        <Link className="button-primary" href="/contact">Contact the gallery ↗</Link>
      </section>
    </div>
  );
}
