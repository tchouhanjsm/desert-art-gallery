import type { NextConfig } from "next";

const remotePatterns: NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> = [];
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

if (supabaseUrl) {
  try {
    const storageOrigin = new URL(supabaseUrl);
    const isHttps = storageOrigin.protocol === "https:";
    const isLocalHttp = storageOrigin.protocol === "http:"
      && ["localhost", "127.0.0.1"].includes(storageOrigin.hostname);
    if (isHttps || isLocalHttp) {
      const pattern = {
        protocol: isHttps ? "https" as const : "http" as const,
        hostname: storageOrigin.hostname,
        ...(storageOrigin.port ? { port: storageOrigin.port } : {}),
      };
      remotePatterns.push({ ...pattern, pathname: "/storage/v1/object/sign/**" });
      remotePatterns.push({ ...pattern, pathname: "/storage/v1/object/public/**" });
    }
  } catch {
    // Invalid or absent storage configuration leaves remote optimization disabled.
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24,
    remotePatterns,
  },
  experimental: {
    // The largest accepted media file is 12 MB; allow multipart overhead without
    // making the application accept unbounded uploads at the route level.
    serverActions: {
      bodySizeLimit: "13mb",
    },
  },
};

export default nextConfig;
