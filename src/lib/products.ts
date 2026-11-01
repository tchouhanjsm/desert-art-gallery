export type ProductImage = {
  id: string;
  url: string;
  altText: string;
  sortOrder: number;
  isPrimary: boolean;
};

export type Product = {
  id?: string;
  slug: string;
  name: string;
  category: string;
  image: string;
  imageAlt: string;
  note: string;
  availability: "inquiry";
  priceMinor?: number | null;
  currency?: string;
  quantityOnHand?: number;
  isOneOfAKind?: boolean;
  collectionSlugs?: string[];
  featured?: boolean;
  description?: string;
  materials?: string[];
  sizes?: string[];
  measurements?: Record<string, unknown>;
  conditionNotes?: string;
  provenance?: string;
  craftStory?: string;
  images?: ProductImage[];
  seoTitle?: string | null;
  seoDescription?: string | null;
};

// Development-only catalogue placeholders. Production storefront data must come
// from active Supabase records with merchant-owned, rights-confirmed media.
const previewImage = "/images/textile-placeholder.svg";

export const products: Product[] = [
  {
    slug: "banjara-vintage-embroidered-jacket",
    name: "Banjara Vintage Embroidered Jacket",
    category: "Banjara & Tribal",
    image: previewImage,
    imageAlt: "Textile-inspired placeholder; original product photography is pending owner approval.",
    note: "A study in colour, memory and hand-worked textile",
    availability: "inquiry",
    featured: true,
  },
  {
    slug: "mukka-embroidery-zari-jacket",
    name: "Mukka Embroidery Zari Jacket",
    category: "Mukka & Zari",
    image: previewImage,
    imageAlt: "Textile-inspired placeholder; original product photography is pending owner approval.",
    note: "Intricate surface, considered detail",
    availability: "inquiry",
    featured: true,
  },
  {
    slug: "vintage-nomadic-embroidery-long-jacket",
    name: "Vintage Nomadic Embroidery Long Jacket",
    category: "Vintage Textiles",
    image: previewImage,
    imageAlt: "Textile-inspired placeholder; original product photography is pending owner approval.",
    note: "An expressive layer with a past",
    availability: "inquiry",
    featured: true,
  },
  {
    slug: "vintage-nomadic-mirrorwork-jacket",
    name: "Vintage Nomadic Mirrorwork Jacket",
    category: "Banjara & Tribal",
    image: previewImage,
    imageAlt: "Textile-inspired placeholder; original product photography is pending owner approval.",
    note: "A richly detailed textile composition",
    availability: "inquiry",
    featured: true,
  },
];

export const collections = [
  { name: "Banjara Embroidery", slug: "banjara", description: "Colour-rich heritage jackets and expressive handwork.", image: previewImage },
  { name: "Vintage Kantha", slug: "kantha", description: "Textiles given another life through thoughtful making.", image: previewImage },
  { name: "Tribal & Nomadic", slug: "tribal", description: "Distinctive patterns, timeworn surfaces and character.", image: previewImage },
  { name: "Mukka & Zari", slug: "mukka-zari", description: "Textural embellishment and considered detail.", image: previewImage },
];
