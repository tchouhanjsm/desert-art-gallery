import Image from "next/image";

export const metadata = {
  title: "Our approach",
  description: "Learn about Desert Art Gallery, a textile-led gallery based in Jaisalmer, Rajasthan.",
};

export default function StoryPage() {
  return (
    <div>
      <div className="page-shell">
        <div className="page-heading story-heading">
          <div className="section-kicker">DESERT ART GALLERY · JAISALMER</div>
          <h1>Textiles, objects<br />and their context.</h1>
          <p>A gallery perspective from Jaisalmer, Rajasthan.</p>
        </div>
      </div>
      <div className="story-hero">
        <Image src="/images/textile-placeholder.svg" alt="" fill sizes="100vw" unoptimized />
      </div>
      <div className="page-shell">
        <div className="info-copy">
          <p>Desert Art Gallery is based in Jaisalmer, Rajasthan. Our focus is the visual language of textiles and objects, and the context that helps people understand what they are considering.</p>
          <p>Every published product should be accompanied by the information the gallery can verify. Materials, measurements, condition, provenance and availability are not assumed; they are confirmed piece by piece.</p>
          <h2>Respect for the people behind the work</h2>
          <p>Craft is knowledge, time and work carried by people and communities. Maker names, biographies, portraits and production details should appear only after the people involved have reviewed and approved their use.</p>
          <h2>A considered conversation</h2>
          <p>If you are interested in a piece, contact the gallery with its name or link and your destination country. Please wait for written confirmation of the item details, final price and delivery charges before sending payment.</p>
        </div>
      </div>
    </div>
  );
}
