import { describe, expect, it, vi } from "vitest";
import { fetchEtsyImageBytes } from "./etsy-image-downloader";

describe("Etsy image download transport", () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0x00, 0x01]);

  it("rejects non-Etsy hosts before making a network request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(fetchEtsyImageBytes("https://example.com/private.jpg", fetcher))
      .rejects.toThrow("approved Etsy static-image URL");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects redirects to hosts outside the approved Etsy image CDN", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: "https://example.com/private.jpg" },
    }));
    await expect(fetchEtsyImageBytes("https://i.etsystatic.com/123/photo.jpg", fetcher))
      .rejects.toThrow("redirect left the approved");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("follows redirects only when they remain on the approved Etsy image host", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { location: "/123/photo-final.jpg" },
      }))
      .mockResolvedValueOnce(new Response(jpeg, {
        status: 200,
        headers: { "content-type": "image/jpeg", "content-length": String(jpeg.length) },
      }));
    const result = await fetchEtsyImageBytes("https://i.etsystatic.com/123/photo.jpg", fetcher);
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.bytes).toEqual(jpeg);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects a mismatch between the CDN content type and the image signature", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(jpeg, {
      status: 200,
      headers: { "content-type": "image/png" },
    }));
    await expect(fetchEtsyImageBytes("https://i.etsystatic.com/123/photo.jpg", fetcher))
      .rejects.toThrow("does not match the CDN Content-Type");
  });

  it("rejects images whose declared size exceeds the upload limit", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, {
      status: 200,
      headers: { "content-type": "image/jpeg", "content-length": String(12 * 1024 * 1024 + 1) },
    }));
    await expect(fetchEtsyImageBytes("https://i.etsystatic.com/123/photo.jpg", fetcher))
      .rejects.toThrow("12 MB download limit");
  });
});
