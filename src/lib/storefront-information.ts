export type StorefrontInformationPage = {
  title: string;
  intro: string;
  body: string[];
  draftNotice?: string;
};

/**
 * Customer information pages are Japanese-first, but policy details remain
 * provisional until the merchant supplies and approves the actual terms.
 * Never infer seller identity, delivery promises, legal obligations or fees.
 */
export const storefrontInformationPages: Record<string, StorefrontInformationPage> = {
  shipping: {
    title: "Shipping information",
    intro: "Shipping arrangements depend on the product and destination.",
    body: [
      "Delivery availability, shipping costs and estimated arrival times vary by product and destination. Before purchase, share your country and postal code so the gallery can check the options and provide an individual estimate.",
      "Import duties, taxes and customs fees may be charged to the recipient under the rules of the destination country. We will share the information available to us before dispatch.",
      "Once an item has shipped, we will share the carrier tracking details when a tracking number is issued.",
    ],
    draftNotice: "Delivery regions, shipping costs and arrival estimates have not yet been confirmed. Please check the terms for your product and destination before ordering.",
  },
  returns: {
    title: "Returns and exchanges",
    intro: "Please confirm the conditions for each item before ordering.",
    body: [
      "Return and exchange eligibility may vary by item. For vintage pieces and textiles with individual variations, please confirm the condition and item-specific terms in writing before purchase.",
      "If an item arrives damaged or materially differs from the description agreed before purchase, contact the gallery promptly with your order number and photographs showing its condition.",
      "The formal returns and exchanges policy will be published after review and approval by the business operator.",
    ],
    draftNotice: "This page is a preliminary notice, not a formal returns policy. Please ask the gallery to confirm the conditions for your item before placing an order.",
  },
  faq: {
    title: "Frequently asked questions",
    intro: "Answers to common questions before you buy.",
    body: [
      "Q. How can I check whether an item is available?\nA. Contact the gallery with the product name. Availability will be checked before any payment is accepted.",
      "Q. Can I ask about sizing and measurements?\nA. Yes. Contact the gallery with questions about the exact measurements and fit of the individual item.",
      "Q. Do you ship internationally?\nA. Availability depends on the destination. Share your country and postal code so the gallery can check.",
      "Q. Will the item look exactly like the photograph?\nA. Vintage and handmade pieces may vary individually. Please confirm the exact item you will receive before purchasing.",
    ],
    draftNotice: "This is general information only. Please confirm the condition, availability and shipping terms for your specific item before ordering.",
  },
  tracking: {
    title: "Order tracking",
    intro: "Information about tracking after dispatch.",
    body: [
      "Tracking details will be shared once the carrier issues a tracking number. Include your order number when asking about delivery progress.",
      "This page is not currently connected to a carrier tracking system.",
    ],
    draftNotice: "Automatic tracking lookup is not available on this page. Contact the gallery for tracking information.",
  },
  privacy: {
    title: "Privacy policy",
    intro: "How customer information is handled.",
    body: [
      "This draft is for review while the privacy policy is being prepared. Before publication, the business must confirm and specify its legal name, privacy contact, service providers, retention periods, legal bases for processing and the rights applicable to customers.",
      "Do not send sensitive payment information, such as credit card numbers, by email.",
    ],
    draftNotice: "This is a draft for review, not the official privacy policy. Do not rely on it as a legal notice until the business details and actual data practices have been confirmed.",
  },
  terms: {
    title: "Terms of service",
    intro: "Terms and conditions for purchases.",
    body: [
      "The formal terms require approval by the business operator and review for each country in which products will be sold. They must clearly define the seller, order acceptance, pricing, payment, shipping, duties, returns, warranties, dispute handling and governing law.",
      "This staging environment does not currently collect online payments or create legally binding accepted orders.",
    ],
    draftNotice: "This is a draft for review, not the official terms of service. Do not treat it as the purchase terms until the seller and sales conditions have been confirmed and approved.",
  },
};

export function getStorefrontInformationPage(slug: string): StorefrontInformationPage | null {
  return storefrontInformationPages[slug] ?? null;
}
