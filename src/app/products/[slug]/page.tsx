import Link from "next/link";
import { notFound } from "next/navigation";
import { getStorefrontProduct } from "@/lib/catalogue";
import { products, type ProductImage } from "@/lib/products";
import { formatMoneyFromMinor } from "@/lib/money";
import { formatProductMeasurements } from "@/lib/product-details";
import type { Metadata } from "next";
import { AddToBagButton } from "@/components/AddToBagButton";
import { ProductGallery } from "@/components/ProductGallery";
import { WishlistToggle } from "@/components/WishlistToggle";

export function generateStaticParams() {
  return process.env.NODE_ENV === "development" ? products.map((product) => ({ slug: product.slug })) : [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getStorefrontProduct(slug);
  if (!product) return {};

  const description = product.seoDescription?.trim()
    || product.description?.trim()
    || product.note.trim();

  return {
    title: product.seoTitle?.trim() || product.name,
    ...(description ? { description } : {}),
    openGraph: {
      images: product.images?.length
        ? product.images.map((image) => image.url)
        : [product.image],
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getStorefrontProduct(slug);
  if (!product) notFound();

  const priceLabel = product.priceMinor != null && product.currency
    ? formatMoneyFromMinor(product.priceMinor, product.currency)
    : "Price available on enquiry";

  const galleryImages: ProductImage[] = product.images?.length
    ? product.images
    : [{
      id: "development-preview",
      url: product.image,
      altText: product.imageAlt || product.name,
      sortOrder: 0,
      isPrimary: true,
    }];

  const measurements = formatProductMeasurements(product.measurements);
  const materials = product.materials ?? [];
  const sizes = product.sizes ?? [];
  const hasProductInformation = Boolean(
    product.description
    || materials.length
    || sizes.length
    || measurements.length
    || product.conditionNotes
    || product.provenance
    || product.craftStory,
  );

  return (
    <div className="page-shell">
      <div className="breadcrumb">
        <Link href="/shop">SHOP</Link>
        {product.category ? " / " + product.category.toUpperCase() : ""}
      </div>
      <div className="product-detail">
        <ProductGallery images={galleryImages} title={product.name} />
        <div className="detail-copy">
          {product.category && <div className="section-kicker">{product.category}</div>}
          <h1 className="section-title">{product.name}</h1>
          {product.note && <div className="detail-note">{product.note}</div>}
          <div className="detail-price">{priceLabel}</div>
          <div className="product-availability">
            {product.id && product.quantityOnHand === 0
              ? "NO CURRENT STOCK RECORDED — CONTACT THE GALLERY"
              : product.id && product.quantityOnHand !== undefined
                ? "AVAILABILITY SUBJECT TO FINAL CONFIRMATION"
                : "CONTACT THE GALLERY TO CONFIRM AVAILABILITY"}
          </div>
          <p className="product-purchase-guidance">
            Review the information supplied for this listing. Contact the gallery if you need clarification before making a purchase decision.
          </p>
          {product.id
            && product.priceMinor != null
            && product.currency
            && product.quantityOnHand !== undefined
            && product.quantityOnHand > 0
            && <AddToBagButton slug={product.slug} quantityOnHand={product.quantityOnHand} />}
          <WishlistToggle slug={product.slug} />
          <a
            className="button-outline enquiry-button"
            href={"mailto:hello@desertartgallery.net?subject=" + encodeURIComponent("Enquiry: " + product.name)}
          >
            ENQUIRE ABOUT THIS PIECE
          </a>
          <div className="detail-footnote">
            Desert Art Gallery · Jaisalmer, Rajasthan, India<br />
            Confirm the final price, availability and delivery charges with the gallery before payment.
          </div>
        </div>
      </div>

      {hasProductInformation && (
        <section className="product-information" aria-labelledby="product-information-heading">
          <div className="section-kicker">LISTING INFORMATION</div>
          <h2 id="product-information-heading" className="section-title">Product details</h2>
          {product.description && <p className="product-long-description">{product.description}</p>}
          <dl className="product-attribute-list">
            {materials.length > 0 && (
              <div><dt>Materials</dt><dd>{materials.join(", ")}</dd></div>
            )}
            {sizes.length > 0 && (
              <div><dt>Sizes</dt><dd>{sizes.join(", ")}</dd></div>
            )}
            {measurements.length > 0 && (
              <div>
                <dt>Measurements</dt>
                <dd>
                  <dl className="product-measurements">
                    {measurements.map((measurement) => (
                      <div key={measurement.label}>
                        <dt>{measurement.label}</dt>
                        <dd>{measurement.value}</dd>
                      </div>
                    ))}
                  </dl>
                </dd>
              </div>
            )}
            {product.conditionNotes && (
              <div><dt>Condition notes</dt><dd>{product.conditionNotes}</dd></div>
            )}
            {product.provenance && (
              <div><dt>Provenance</dt><dd>{product.provenance}</dd></div>
            )}
            {product.craftStory && (
              <div><dt>Additional story</dt><dd>{product.craftStory}</dd></div>
            )}
          </dl>
        </section>
      )}
    </div>
  );
}
