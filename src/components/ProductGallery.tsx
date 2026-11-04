"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { galleryBlurDataUrl } from "@/lib/image";
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
        <Image placeholder="blur" blurDataURL={galleryBlurDataUrl}
          key={active.id}
          src={active.url}
          alt={active.altText || title}
          fill
          priority
          sizes="(max-width:700px) 90vw, 55vw"
        />
        {images.length > 1 && (
          <div className="product-gallery-navigation" aria-label="商品画像の操作">
            <button type="button" onClick={previous} aria-label="前の商品画像を見る">
              <ChevronLeft size={19} aria-hidden="true" />
            </button>
            <span aria-hidden="true">{String(activeIndex + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}</span>
            <button type="button" onClick={next} aria-label="次の商品画像を見る">
              <ChevronRight size={19} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div className="product-gallery-thumbnails" role="group" aria-label="商品画像を選択する">
          {images.map((image, index) => (
            <button
              className="product-gallery-thumb"
              type="button"
              key={image.id}
              aria-label={"商品画像 " + (index + 1) + " / " + images.length}
              aria-pressed={activeIndex === index}
              onClick={() => setActiveIndex(index)}
            >
              <Image placeholder="blur" blurDataURL={galleryBlurDataUrl}
                src={image.url}
                alt=""
                width={76}
                height={96}
                sizes="76px"
              />
            </button>
          ))}
        </div>
      )}
      <span className="visually-hidden" aria-live="polite">
        {activeIndex + 1}枚目 / 全{images.length}枚: {active.altText || title}
      </span>
    </div>
  );
}
