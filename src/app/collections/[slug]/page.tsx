import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStorefrontCollections, getStorefrontProducts } from "@/lib/catalogue";
import { collections } from "@/lib/products";

export function generateStaticParams() {
  return collections.map((collection) => ({ slug: collection.slug }));
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

  return <div className="page-shell">
    <div className="page-heading">
      <div className="section-kicker">CURATED COLLECTION</div>
      <h1>{collection.name}</h1>
      <p>{collection.description}</p>
    </div>
    {productsInCollection.length ? <div className="product-grid">{productsInCollection.map((product) =>
      <Link className="product-card" href={`/products/${product.slug}`} key={product.slug}>
        <div className="product-image-wrap"><Image src={product.image} alt={product.imageAlt} fill sizes="(max-width:700px) 48vw, 24vw" unoptimized/></div>
        <div className="product-meta"><h2 className="product-name">{product.name}</h2><div className="product-availability">ENQUIRE FOR DETAILS</div></div>
      </Link>
    )}</div> : <div className="empty-note">This collection is being curated. Contact the gallery for current pieces.</div>}
  </div>;
}
