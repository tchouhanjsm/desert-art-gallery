export type StorefrontInformationPage = {
  title: string;
  intro: string;
  body: string[];
  draftNotice?: string;
};

/**
 * Customer information pages are presented in English. Policy details remain
 * provisional until the merchant supplies and approves the actual terms.
 * Never infer seller identity, delivery promises, legal obligations or fees.
 */
export const storefrontInformationPages: Record<string, StorefrontInformationPage> = {
  shipping: {
    title: "Shipping information",
    intro: "Shipping details depend on the destination and the item.",
    body: [
      "Available destinations, shipping charges and estimated delivery times vary by item and destination. Before purchasing, please share your country and postal code so the gallery can check the options and provide a quote.",
      "Import duties, taxes and customs fees may be charged to the recipient under the rules of the destination country. We will share the information available to the gallery before dispatch.",
      "When the carrier provides a tracking number after dispatch, we will share the tracking details.",
    ],
    draftNotice: "Destinations, shipping charges and delivery timing have not yet been confirmed. Please check the conditions for your item and destination before placing an order.",
  },
  returns: {
    title: "Returns & exchanges",
    intro: "Please review the conditions for each item before ordering.",
    body: [
      "Return or exchange eligibility may vary by item. For vintage pieces and textiles with individual variations, please request written confirmation of the item's condition and applicable terms before purchasing.",
      "If an item arrives damaged or materially differs from the description agreed before purchase, contact the gallery promptly with your order number and photographs showing its condition.",
      "The official returns and exchanges policy will be published after it has been reviewed and approved by the merchant.",
    ],
    draftNotice: "This page is an interim guide, not an official returns or exchanges policy. Please confirm the terms for each item before ordering.",
  },
  faq: {
    title: "Frequently asked questions",
    intro: "Answers to common questions before you purchase.",
    body: [
      "Q. How can I check whether an item is available?\nA. Contact the gallery with the product name. Availability will be checked before any payment is accepted.",
      "Q. Can I ask about sizing and measurements?\nA. Yes. Contact the gallery with questions about the actual measurements and fit of a specific item.",
      "Q. Do you ship internationally?\nA. Availability depends on the destination. Share your country and postal code so the gallery can check whether delivery is possible.",
      "Q. Will the item look exactly like the photograph?\nA. Vintage and handmade pieces may vary individually. Please confirm the exact item you will receive before purchasing.",
    ],
    draftNotice: "This is general information only. Please confirm the condition, availability and delivery terms for each item before ordering.",
  },
  tracking: {
    title: "Order tracking",
    intro: "Information about tracking after dispatch.",
    body: [
      "Once the carrier issues a tracking number, the gallery will share the tracking information. Include your order number when asking about a shipment.",
      "This page is not currently connected to a carrier tracking service.",
    ],
    draftNotice: "This page cannot look up tracking numbers automatically. Contact the gallery for tracking information.",
  },
  privacy: {
    title: "Privacy notice",
    intro: "How customer information is handled.",
    body: [
      "This draft is for review while the gallery's privacy practices are being established. Before publication, it must identify the actual merchant, privacy contact, service providers, retention periods, legal bases for processing and customer rights that apply.",
      "Do not send sensitive payment information, such as card numbers, by email.",
    ],
    draftNotice: "This is a pre-publication draft, not an official privacy notice. Do not rely on it as a legal statement until the merchant details and actual data practices have been verified.",
  },
  terms: {
    title: "Terms of use",
    intro: "Terms relating to purchases.",
    body: [
      "The official terms require merchant approval and review for each intended sales market. They must clearly define the seller, order formation, prices, payment, delivery, duties, returns, warranties, dispute handling and governing law.",
      "This preview environment does not process online payments or create legally binding confirmed orders.",
    ],
    draftNotice: "This is a pre-publication draft, not the official terms of use. Do not treat it as contractual purchase terms until the actual seller and sales conditions have been reviewed and approved.",
  },
};

export function getStorefrontInformationPage(slug: string): StorefrontInformationPage | null {
  return storefrontInformationPages[slug] ?? null;
}
