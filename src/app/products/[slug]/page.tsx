import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStorefrontProduct } from "@/lib/catalogue";
import { products } from "@/lib/products";
import { formatMoneyFromMinor } from "@/lib/money";
import type { Metadata } from "next";

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getStorefrontProduct(slug);
  return product ? {
    title: product.name,
    description: product.note || `Discover ${product.name} from Desert Art Gallery, Jaisalmer.`,
    openGraph: { images: [product.image] },
  } : {};
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getStorefrontProduct(slug);
  if (!product) notFound();

  const priceLabel = product.priceMinor != null && product.currency
    ? formatMoneyFromMinor(product.priceMinor, product.currency)
    : "Price and availability on enquiry";

  return <div className="page-shell">
    <div className="breadcrumb"><Link href="/shop">SHOP</Link> / {product.category.toUpperCase()}</div>
    <div className="product-detail">
      <div className="product-image-wrap detail-image">
        <Image src={product.image} alt={product.imageAlt} fill sizes="(max-width:700px) 90vw, 55vw" unoptimized/>
      </div>
      <div className="detail-copy">
        <div className="section-kicker">{product.category}</div>
        <h1 className="section-title">{product.name}</h1>
        <div className="detail-note">{product.note}</div>
        <div className="detail-price">{priceLabel}</div>
        <div className="product-availability">
          {product.quantityOnHand === 0 && product.id ? "CURRENTLY UNAVAILABLE — PLEASE CONTACT US" : "ASK US TO CONFIRM CURRENT AVAILABILITY"}
        </div>
        <p>Every textile has its own character. Contact our team to confirm the exact piece, measurements, condition notes, fabric details and delivery options before purchase.</p>
        <a className="button-primary dark-button" href={`mailto:hello@desertartgallery.net?subject=${encodeURIComponent("Enquiry: " + product.name)}`}>
          ENQUIRE ABOUT THIS PIECE
        </a>
        <div className="detail-footnote">Desert Art Gallery · Jaisalmer, Rajasthan, India<br/>Please obtain written confirmation of the final price, availability and delivery charges before payment.</div>
      </div>
    </div>
  </div>;
}
