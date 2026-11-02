import Link from "next/link";
import { notFound } from "next/navigation";
import { StorefrontProductCard } from "@/components/StorefrontProductCard";
import { getStorefrontCollections, getStorefrontProducts } from "@/lib/catalogue";
import { collections } from "@/lib/products";

export function generateStaticParams() {
  return process.env.NODE_ENV === "development" ? collections.map((collection) => ({ slug: collection.slug })) : [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const publishedCollections = await getStorefrontCollections();
  const collection = publishedCollections.find((item) => item.slug === slug);
  return collection ? {
    title: collection.name,
    description: collection.description,
  } : {};
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [publishedCollections, products] = await Promise.all([
    getStorefrontCollections(),
    getStorefrontProducts(),
  ]);
  const collection = publishedCollections.find((item) => item.slug === slug);
  if (!collection) notFound();

  const productsInCollection = products.filter((product) => {
    if (product.collectionSlugs) return product.collectionSlugs.includes(slug);
    if (slug === "banjara" || slug === "tribal") return product.category === "Banjara & Tribal";
    if (slug === "mukka-zari") return product.category === "Mukka & Zari";
    return product.category === "Vintage Textiles";
  });

  return (
    <div className="page-shell atelier-page-shell">
      <header className="atelier-page-heading atelier-collection-heading">
        <div className="section-kicker">A CURATED PATH THROUGH THE GALLERY</div>
        <h1>{collection.name}<em>.</em></h1>
        <p>{collection.description}</p>
        <Link className="text-link" href="/shop">Explore all pieces <span aria-hidden="true">↗</span></Link>
      </header>
      {productsInCollection.length ? (
        <div className="atelier-product-grid">
          {productsInCollection.map((product) => <StorefrontProductCard key={product.slug} product={product} />)}
        </div>
      ) : (
        <div className="atelier-empty-catalogue">
          <span className="atelier-empty-mark" aria-hidden="true">✳</span>
          <h2>This collection is being curated.</h2>
          <p>Contact the gallery for current pieces and availability.</p>
          <Link className="button-outline" href="/contact">Contact the gallery</Link>
        </div>
      )}
    </div>
  );
}
