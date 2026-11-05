"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { StorefrontImage } from "@/components/StorefrontImage";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { galleryBlurDataUrl } from "@/lib/image";
import type { ProductImage } from "@/lib/products";
import { resolveProductGallerySwipe } from "@/lib/product-gallery-gesture";

export function ProductGallery({ images, title }: { images: ProductImage[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const active = images[activeIndex] ?? images[0];

  if (!active) return null;

  const showPrevious = () => setActiveIndex((current) => (current - 1 + images.length) % images.length);
  const showNext = () => setActiveIndex((current) => (current + 1) % images.length);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (images.length < 2 || event.pointerType !== "touch") return;
    if (event.target instanceof Element && event.target.closest("button")) return;
    touchStart.current = { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || images.length < 2) return;

    const direction = resolveProductGallerySwipe(start, { x: event.clientX, y: event.clientY });
    if (direction === "next") showNext();
    if (direction === "previous") showPrevious();
  }

  function handlePointerCancel() {
    touchStart.current = null;
  }

  return (
    <div
      className="detail-gallery"
      role="group"
      aria-label={title + " product image gallery"}
    >
      <div
        className="product-image-wrap detail-image detail-gallery-main"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <StorefrontImage placeholder="blur" blurDataURL={galleryBlurDataUrl}
          key={active.id}
          src={active.url}
          alt={active.altText || title}
          fill
          priority
          sizes="(max-width:700px) 90vw, 55vw"
        />
        {images.length > 1 && (
          <div className="product-gallery-navigation" aria-label="Product image navigation">
            <button type="button" onClick={showPrevious} aria-label="View previous product image">
              <ChevronLeft size={19} aria-hidden="true" />
            </button>
            <span aria-hidden="true">{String(activeIndex + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}</span>
            <button type="button" onClick={showNext} aria-label="View next product image">
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
              aria-label={"Product image " + (index + 1) + " / " + images.length}
              aria-pressed={activeIndex === index}
              onClick={() => setActiveIndex(index)}
            >
              <StorefrontImage placeholder="blur" blurDataURL={galleryBlurDataUrl}
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
        {activeIndex + 1} of {images.length} images: {active.altText || title}
      </span>
    </div>
  );
}
