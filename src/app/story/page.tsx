import Link from "next/link";

export const metadata = {
  title: "Our story",
  description: "Discover Desert Art Gallery, based in Jaisalmer, Rajasthan, India.",
};

export default function StoryPage() {
  return (
    <div className="atelier-story-page">
      <header className="atelier-story-masthead">
        <div className="section-kicker">JAISALMER · RAJASTHAN</div>
        <h1>Textiles and objects,<br /><em>and the stories behind them.</em></h1>
        <p>From Jaisalmer, Rajasthan, India.</p>
      </header>

      <figure className="atelier-story-visual">
        <div className="atelier-story-visual-art" role="img" aria-label="A geometric textile-inspired design study. This is not a product photograph.">
          <span className="atelier-story-visual-monogram">DAG</span>
          <span className="atelier-story-visual-caption">MATERIAL · MEMORY · MAKING</span>
        </div>
        <figcaption><span>DESIGN STUDY · TEXTILE PATTERN</span><span>ORIGINAL GALLERY PHOTOGRAPHY COMING SOON</span></figcaption>
      </figure>

      <div className="atelier-story-content">
        <article className="atelier-story-article">
          <span className="section-kicker">OUR APPROACH</span>
          <h2>Look closely at each piece.<br /><em>Understand what makes it special.</em></h2>
          <p>Desert Art Gallery is based in Jaisalmer, Rajasthan. We value the character of textiles and objects, alongside the information that helps people understand each piece.</p>
          <p>Every published listing is based on information the gallery can verify. We review materials, measurements, condition, provenance and availability individually rather than filling gaps with assumptions.</p>

          <h3>Respect for makers</h3>
          <p>Handmade work carries knowledge, time and skill passed between people and communities. We publish a maker’s name, profile, photographs or process only after the maker has reviewed and approved the content and its intended use.</p>

          <h3>Questions about a piece</h3>
          <p>For an enquiry, please include the product name or page link and your destination country. Before making any payment, request written confirmation of the item, final price and delivery costs.</p>
        </article>

        <aside className="atelier-story-aside">
          <div className="atelier-story-aside-mark">DAG</div>
          <span>BASED IN</span>
          <strong>Jaisalmer</strong>
          <span>Rajasthan · India</span>
          <div className="atelier-story-aside-rule" />
          <p>Textiles. Objects. Stories.</p>
          <Link className="text-link" href="/shop">Explore the collection</Link>
        </aside>
      </div>

      <section className="atelier-story-close">
        <span className="section-kicker">CONTACT</span>
        <h2>Have a question about a piece?</h2>
        <p>Send us the product name or link and your question. We will share the information we can verify.</p>
        <Link className="button-primary" href="/contact">CONTACT</Link>
      </section>
    </div>
  );
}
