import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl } from "./site-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("site URL configuration", () => {
  it("defaults to localhost instead of assuming a production domain", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

    expect(getSiteUrl().toString()).toBe("http://localhost:3000/");
  });

  it("uses a configured HTTPS origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://gallery.example.org");

    expect(getSiteUrl().toString()).toBe("https://gallery.example.org/");
  });

  it("rejects non-local HTTP origins", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://gallery.example.org");

    expect(() => getSiteUrl()).toThrow("NEXT_PUBLIC_SITE_URL must use HTTPS outside local development.");
  });

  it("rejects paths instead of silently changing canonical URL scope", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://gallery.example.org/shop");

    expect(() => getSiteUrl()).toThrow("NEXT_PUBLIC_SITE_URL must be an origin without credentials, path, query or hash.");
  });
});
