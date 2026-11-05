"use client";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import type { ProductVariant } from "@/lib/products";
import { capPurchasableQuantity, resolveVariantPriceMinor } from "@/lib/variants";
import { formatMoneyFromMinor } from "@/lib/money";

export function AddToBagButton({
  slug,
  quantityOnHand,
  variants = [],
  priceMinor,
  currency,
  isOneOfAKind = false,
}: {
  slug: string;
  quantityOnHand: number;
  variants?: ProductVariant[];
  priceMinor: number | null;
  currency: string;
  isOneOfAKind?: boolean;
}) {
  const { addItem } = useCart();
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [added, setAdded] = useState(false);
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId);
  const hasVariants = variants.length > 0;
  const rawMaximum = hasVariants ? selectedVariant?.quantityOnHand ?? 0 : quantityOnHand;
  const maximum = capPurchasableQuantity(rawMaximum, isOneOfAKind);
  const selectedPrice = selectedVariant
    ? resolveVariantPriceMinor(selectedVariant.priceMinor, priceMinor)
    : priceMinor;
  const canAdd = maximum > 0 && (!hasVariants || Boolean(selectedVariant));

  return (
    <div className="add-to-bag-control">
      {hasVariants && (
        <label className="variant-select-label">
          Select an option
          <select
            value={selectedVariantId}
            onChange={(event) => {
              setSelectedVariantId(event.target.value);
              setAdded(false);
            }}
            required
          >
            <option value="">Please select an option</option>
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id} disabled={variant.quantityOnHand < 1}>
                {variant.label}{variant.quantityOnHand < 1 ? " — Sold out" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {hasVariants && selectedVariant && selectedPrice !== null && (
        <p className="variant-selected-price">
          Selected option · {formatMoneyFromMinor(selectedPrice, currency)}
        </p>
      )}
      <button
        className="button-primary dark-button add-to-bag"
        type="button"
        disabled={!canAdd}
        onClick={() => {
          if (!canAdd) return;
          addItem(slug, maximum, selectedVariant?.id);
          setAdded(true);
        }}
      >
        {!canAdd
          ? hasVariants && !selectedVariant ? "Please select an option" : "Currently unavailable"
          : added ? "Added to bag ✓" : "Add to bag"}
      </button>
    </div>
  );
}
