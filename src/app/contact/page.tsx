export const metadata = {
  title: "Contact",
  description: "Contact Desert Art Gallery in Jaisalmer, Rajasthan, about published pieces and gallery enquiries.",
};

export default function ContactPage() {
  return (
    <div className="page-shell">
      <div className="page-heading">
        <div className="section-kicker">A DIRECT CONVERSATION</div>
        <h1>Contact the gallery</h1>
        <p>Questions about a published piece, its details or delivery to your destination?</p>
      </div>
      <div className="info-copy">
        <p>Write to us with the name or link of the piece you are interested in and your destination country. We will confirm which details are available for that specific item.</p>
        <h2>Desert Art Gallery</h2>
        <p>Jaisalmer, Rajasthan, India</p>
        <p><a className="contact-link" href="mailto:hello@desertartgallery.net">hello@desertartgallery.net ↗</a></p>
        <h2 id="delivery-enquiries">Delivery enquiries</h2>
        <p>Shipping availability, charges, taxes or duties and estimated delivery details depend on the destination and the confirmed order. Please request a written quotation before making payment; no rate or delivery promise is implied by this page.</p>
        <h2 id="product-enquiries">Product enquiries</h2>
        <p>Materials, measurements, condition and provenance should be confirmed for the individual piece. Please ask for the relevant details before deciding to purchase.</p>
      </div>
    </div>
  );
}
