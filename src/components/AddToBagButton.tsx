"use client";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";
export function AddToBagButton({ slug, quantityOnHand }: { slug: string; quantityOnHand: number }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  return <button className="button-primary dark-button add-to-bag" type="button" disabled={quantityOnHand < 1} onClick={() => { addItem(slug, quantityOnHand); setAdded(true); }}>
    {quantityOnHand < 1 ? "CURRENTLY UNAVAILABLE" : added ? "ADDED TO YOUR BAG ✓" : "ADD TO BAG"}
  </button>;
}
