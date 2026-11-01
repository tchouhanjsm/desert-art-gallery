import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // The largest accepted media file is 12 MB; allow multipart overhead without
    // making the application accept unbounded uploads at the route level.
    serverActions: {
      bodySizeLimit: "13mb",
    },
  },
};

export default nextConfig;
