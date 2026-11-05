type StorefrontMediaPlaceholderProps = {
  variant: "hero" | "product" | "collection";
  label: string;
  caption: string;
};

export function StorefrontMediaPlaceholder({ variant, label, caption }: StorefrontMediaPlaceholderProps) {
  return (
    <div className={"storefront-media-placeholder storefront-media-placeholder--" + variant} role="img" aria-label={label}>
      <span className="storefront-media-placeholder-mark" aria-hidden="true">DAG</span>
      <span className="storefront-media-placeholder-caption">{caption}</span>
    </div>
  );
}
