import Link from "next/link";

export const metadata = {
  title: "Contact the gallery",
  description: "Contact Desert Art Gallery in Jaisalmer, Rajasthan, about published pieces and destination-specific enquiries.",
};

export default function ContactPage() {
  return (
    <div className="page-shell atelier-contact-page">
      <header className="atelier-page-heading atelier-contact-heading">
        <div className="section-kicker">A DIRECT CONVERSATION · JAISALMER</div>
        <h1>Let's talk about <em>a piece.</em></h1>
        <p>Questions about a published object, its materials or delivery to your destination? Share the piece you have in mind and the gallery will help clarify the details available.</p>
      </header>

      <div className="atelier-contact-layout">
        <section className="atelier-contact-main">
          <div className="atelier-contact-card">
            <span className="atelier-contact-card-index">01 / THE GALLERY</span>
            <h2>Write to us.</h2>
            <p>For product questions, availability or a destination-specific enquiry, email the gallery with the product name or page link.</p>
            <a className="atelier-contact-email" href="mailto:hello@desertartgallery.net?subject=Enquiry%20for%20Desert%20Art%20Gallery">hello@desertartgallery.net <span aria-hidden="true">↗</span></a>
            <span className="atelier-contact-location">JAISALMER · RAJASTHAN · INDIA</span>
          </div>
          <div className="atelier-contact-note">
            <span className="section-kicker">A NOTE ON AVAILABILITY</span>
            <p>Product details, condition, provenance, final price and availability should be confirmed for the individual piece before payment. Please request written confirmation from the gallery.</p>
          </div>
        </section>

        <aside className="atelier-contact-guide">
          <span className="section-kicker">MAKE YOUR ENQUIRY USEFUL</span>
          <h2>A few details help us respond.</h2>
          <ol>
            <li><span>01</span><div><strong>The piece</strong><p>Include the product name or a link to its listing.</p></div></li>
            <li><span>02</span><div><strong>Your destination</strong><p>Tell us the destination city and country for delivery questions.</p></div></li>
            <li><span>03</span><div><strong>What you'd like to know</strong><p>Ask about materials, measurements, condition, provenance or availability.</p></div></li>
          </ol>
          <div className="atelier-contact-delivery" id="delivery-enquiries">
            <h3>Delivery enquiries</h3>
            <p>Shipping availability, charges, taxes, duties and estimated delivery depend on the destination and confirmed order. No delivery rate or timing is promised by this page.</p>
            <Link href="/contact#delivery-enquiries">Read the delivery note ↗</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
