import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: { formats: ["image/avif", "image/webp"], minimumCacheTTL: 60 * 60 * 24 * 30 },
  experimental: {
    // The largest accepted media file is 12 MB; allow multipart overhead without
    // making the application accept unbounded uploads at the route level.
    serverActions: {
      bodySizeLimit: "13mb",
    },
  },
};

export default nextConfig;
