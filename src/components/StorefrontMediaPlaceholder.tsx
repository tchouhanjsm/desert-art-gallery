import * as React from "react";

type StorefrontMediaPlaceholderProps = {
  variant: "hero" | "product" | "collection";
  label: string;
  caption: string;
};

export function StorefrontMediaPlaceholder({ variant, label, caption }: StorefrontMediaPlaceholderProps) {
  // Keep the brand signature for the single homepage hero only. Repeating a
  // large DAG monogram in every product/collection tile makes the catalogue
  // feel like a template instead of giving each media surface room to breathe.
  const showBrandMark = variant === "hero";

  return (
    <div className={"storefront-media-placeholder storefront-media-placeholder--" + variant} role="img" aria-label={label}>
      {showBrandMark && (
        <span className="storefront-media-placeholder-mark" aria-hidden="true">DAG</span>
      )}
      <span className="storefront-media-placeholder-caption">{caption}</span>
    </div>
  );
}
