import Link from "next/link";
import { getStorefrontProduct } from "@/lib/catalogue";
import { parseProductEnquirySlug } from "@/lib/product-enquiry";

export const metadata = {
  title: "Contact the gallery",
  description: "Contact information for Desert Art Gallery in Jaisalmer, Rajasthan.",
};

type ContactPageProps = {
  searchParams: Promise<{ product?: string | string[] }>;
};

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const params = await searchParams;
  const requestedSlug = parseProductEnquirySlug(params.product);
  const requestedProduct = requestedSlug ? await getStorefrontProduct(requestedSlug) : null;

  return (
    <div className="page-shell atelier-contact-page">
      <header className="atelier-page-heading atelier-contact-heading">
        <div className="section-kicker">A DIRECT CONVERSATION · JAISALMER</div>
        <h1>Let&apos;s talk about <em>a piece.</em></h1>
        <p>Questions about a published object, its materials or delivery to your destination? The gallery&apos;s verified contact channel will be published here once confirmed. Please check back before sending product or order enquiries.</p>
      </header>

      {requestedProduct && (
        <section className="atelier-enquiry-context" id="product-enquiry" aria-labelledby="enquiry-context-heading">
          <div>
            <span className="section-kicker">YOUR PRODUCT ENQUIRY</span>
            <h2 id="enquiry-context-heading">{requestedProduct.name}</h2>
            <p>{requestedProduct.category || "Desert Art Gallery"} · Product context retained from the listing you selected.</p>
          </div>
          <Link className="text-link" href={"/products/" + requestedProduct.slug}>Return to this piece ↗</Link>
          <p className="atelier-enquiry-status" role="status">
            Your enquiry context is ready, but no message has been sent. The gallery&apos;s official contact channel is still awaiting confirmation.
          </p>
        </section>
      )}

      <div className="atelier-contact-layout">
        <section className="atelier-contact-main">
          <div className="atelier-contact-card">
            <span className="atelier-contact-card-index">01 / THE GALLERY</span>
            <h2>Contact details</h2>
            <p>The gallery&apos;s official email address and enquiry channels will be added here after they have been confirmed.</p>
            <p className="atelier-contact-email">Official contact details pending confirmation.</p>
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
            <li><span>03</span><div><strong>What you&apos;d like to know</strong><p>Ask about materials, measurements, condition, provenance or availability.</p></div></li>
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
