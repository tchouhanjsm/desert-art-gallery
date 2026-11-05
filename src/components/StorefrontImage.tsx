"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

type StorefrontImageProps = Omit<ImageProps, "onError">;

export function StorefrontImage(props: StorefrontImageProps) {
  const [unavailable, setUnavailable] = useState(false);
  if (unavailable) {
    const hasDescription = Boolean(props.alt.trim());
    return (
      <span
        className="jp-image-unavailable"
        role={hasDescription ? "img" : undefined}
        aria-label={hasDescription ? props.alt : undefined}
        aria-hidden={hasDescription ? undefined : true}
      >
        <span aria-hidden="true">Photography unavailable</span>
      </span>
    );
  }
  return <Image {...props} onError={() => setUnavailable(true)} />;
}
