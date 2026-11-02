"use client";

import Image from "next/image";
import { useState } from "react";
import type { ProductImage } from "@/lib/products";

export function ProductGallery({ images, title }: { images: ProductImage[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  if (!active) return null;

  return (
    <div className="detail-gallery">
      <div className="product-image-wrap detail-image detail-gallery-main">
        <Image
          key={active.id}
          src={active.url}
          alt={active.altText || title}
          fill
          priority
          sizes="(max-width:700px) 90vw, 55vw"
          unoptimized
        />
      </div>
      {images.length > 1 && (
        <div className="product-gallery-thumbnails" role="group" aria-label="Product images">
          {images.map((image, index) => (
            <button
              className="product-gallery-thumb"
              type="button"
              key={image.id}
              aria-label={"View image " + (index + 1) + " of " + images.length}
              aria-pressed={activeIndex === index}
              onClick={() => setActiveIndex(index)}
            >
              <Image
                src={image.url}
                alt=""
                width={76}
                height={96}
                sizes="76px"
                unoptimized
              />
            </button>
          ))}
        </div>
      )}
      <span className="visually-hidden" aria-live="polite">
        Image {activeIndex + 1} of {images.length}
      </span>
    </div>
  );
}
