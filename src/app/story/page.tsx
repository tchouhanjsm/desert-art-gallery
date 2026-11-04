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
        <div className="atelier-story-visual-art" role="img" aria-label="A geometric study inspired by textile patterns. This is not product photography.">
          <span className="atelier-story-visual-monogram">DAG</span>
          <span className="atelier-story-visual-caption">MATERIAL · MEMORY · MAKING</span>
        </div>
        <figcaption><span>DESIGN STUDY · TEXTILE PATTERN</span><span>Original gallery photography is in preparation</span></figcaption>
      </figure>

      <div className="atelier-story-content">
        <article className="atelier-story-article">
          <span className="section-kicker">OUR APPROACH</span>
          <h2>Look closely at every piece,<br /><em>and discover its character.</em></h2>
          <p>Desert Art Gallery is based in Jaisalmer, Rajasthan, India. We value the character of each textile and object, together with the information that helps you understand it.</p>
          <p>We publish the details we can verify for each piece. Materials, measurements, condition, provenance and availability are checked individually rather than filled in with assumptions.</p>

          <h3>RESPECT FOR MAKERS</h3>
          <p>Handmade work carries knowledge, time and skill passed through people and communities. A maker’s name, profile, photograph or process is published only after the person has reviewed and approved the content and its use.</p>

          <h3>QUESTIONS ABOUT A PIECE</h3>
          <p>For an enquiry, share the product name or page link and your destination country. Please obtain written confirmation of the product details, final price and shipping costs before making a payment.</p>
        </article>

        <aside className="atelier-story-aside">
          <div className="atelier-story-aside-mark">DAG</div>
          <span>BASED IN</span>
          <strong>Jaisalmer</strong>
          <span>Rajasthan · India</span>
          <div className="atelier-story-aside-rule" />
          <p>Textiles. Objects. Stories.</p>
          <Link className="text-link" href="/shop">Explore the shop</Link>
        </aside>
      </div>

      <section className="atelier-story-close">
        <span className="section-kicker">ENQUIRIES</span>
        <h2>Found something you like?</h2>
        <p>Send us the product name or link with your questions. We will share the details we can verify.</p>
        <Link className="button-primary" href="/contact">Contact the gallery</Link>
      </section>
    </div>
  );
}
