"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { isRemoteImage } from "@/lib/image";
import type { ProductImage } from "@/lib/products";

export function ProductGallery({ images, title }: { images: ProductImage[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  if (!active) return null;

  const previous = () => setActiveIndex((current) => (current - 1 + images.length) % images.length);
  const next = () => setActiveIndex((current) => (current + 1) % images.length);

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
          unoptimized={isRemoteImage(active.url)}
        />
        {images.length > 1 && (
          <div className="product-gallery-navigation" aria-label="Gallery navigation">
            <button type="button" onClick={previous} aria-label="View previous product image">
              <ChevronLeft size={19} aria-hidden="true" />
            </button>
            <span aria-hidden="true">{String(activeIndex + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}</span>
            <button type="button" onClick={next} aria-label="View next product image">
              <ChevronRight size={19} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div className="product-gallery-thumbnails" role="group" aria-label="Choose a product image">
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
                unoptimized={isRemoteImage(image.url)}
              />
            </button>
          ))}
        </div>
      )}
      <span className="visually-hidden" aria-live="polite">
        Image {activeIndex + 1} of {images.length}: {active.altText || title}
      </span>
    </div>
  );
}
