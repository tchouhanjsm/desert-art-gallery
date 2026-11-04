import Link from "next/link";
import { getStorefrontProduct } from "@/lib/catalogue";
import { parseProductEnquirySlug } from "@/lib/product-enquiry";

export const metadata = {
  title: "Contact the gallery",
  description: "How to contact Desert Art Gallery with product and order enquiries.",
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
        <div className="section-kicker">ENQUIRIES · JAISALMER</div>
        <h1><em>Questions about a piece?</em> Get in touch.</h1>
        <p>For questions about listed pieces, materials or delivery to your destination, please use the information below. The gallery’s official contact details will be added once verified. Until then, this page does not accept or send enquiries.</p>
      </header>

      {requestedProduct && (
        <section className="atelier-enquiry-context" id="product-enquiry" aria-labelledby="enquiry-context-heading">
          <div>
            <span className="section-kicker">PRODUCT ENQUIRY</span>
            <h2 id="enquiry-context-heading">{requestedProduct.name}</h2>
            <p>{requestedProduct.category || "Desert Art Gallery"} · The selected product is included in this enquiry context.</p>
          </div>
          <Link className="text-link" href={"/products/" + requestedProduct.slug}>Return to product page</Link>
          <p className="atelier-enquiry-status" role="status">
            Your enquiry context is ready, but no message has been sent. The gallery’s official contact details are still being verified.
          </p>
        </section>
      )}

      <div className="atelier-contact-layout">
        <section className="atelier-contact-main">
          <div className="atelier-contact-card">
            <span className="atelier-contact-card-index">01 / CONTACT</span>
            <h2 >Contact details</h2>
            <p>The official email address and contact process will be published here once confirmed.</p>
            <p className="atelier-contact-email">Official contact details are being verified.</p>
            <span className="atelier-contact-location">Jaisalmer · Rajasthan · India</span>
          </div>
          <div className="atelier-contact-note">
            <span className="section-kicker">AVAILABILITY</span>
            <p>Please confirm each piece’s details, condition, provenance, final price and availability in writing with the gallery before making payment.</p>
          </div>
        </section>

        <aside className="atelier-contact-guide">
          <span className="section-kicker">BEFORE YOU WRITE</span>
          <h2>Please include the following details.</h2>
          <ol>
            <li><span>01</span><div><strong >Product name</strong><p>Include the product name or a link to its product page.</p></div></li>
            <li><span>02</span><div><strong >Destination</strong><p>For shipping enquiries, tell us the destination city and country.</p></div></li>
            <li><span>03</span><div><strong >Your question</strong><p>Let us know what you would like to know about materials, measurements, condition, provenance or availability.</p></div></li>
          </ol>
          <div className="atelier-contact-delivery" id="delivery-enquiries">
            <h3 >Shipping information</h3>
            <p>Delivery availability, shipping costs, taxes, duties and estimated arrival times depend on the destination and confirmed order details. This page does not promise a shipping cost or delivery date.</p>
            <Link href="/contact#delivery-enquiries">Shipping information</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
