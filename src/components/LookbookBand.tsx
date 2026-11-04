import Image from "next/image";
import Link from "next/link";
import { galleryBlurDataUrl } from "@/lib/image";
import type { Product } from "@/lib/products";

/** Editorial lookbook: an asymmetric mosaic of real published pieces. Hidden until
 *  at least three pieces have real photography (no placeholders in the lookbook). */
export function LookbookBand({ products }: { products: Product[] }) {
  const real = products.filter((p) => p.id && p.image && !p.image.endsWith(".svg")).slice(0, 3);
  if (real.length < 3) return null;
  return (
    <section className="lookbook" aria-labelledby="lookbook-title">
      <div className="lookbook-head">
        <div className="section-kicker">THE LOOKBOOK</div>
        <h2 id="lookbook-title" className="section-title">Worn, held, <em>handed down.</em></h2>
      </div>
      <div className="lookbook-grid">
        {real.map((p, i) => (
          <Link key={p.slug} href={"/products/" + p.slug} className={"lookbook-tile lookbook-tile-" + (i + 1)}>
            <Image placeholder="blur" blurDataURL={galleryBlurDataUrl} src={p.image} alt={p.imageAlt} fill sizes="(max-width:760px) 100vw, 40vw" />
            <span className="lookbook-caption"><b>{p.name}</b><i>{p.category}</i></span>
          </Link>
        ))}
      </div>
    </section>
  );
}
