import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "./request-security";

function mutationRequest(url: string, origin?: string, fetchSite?: string) {
  const headers = new Headers();
  if (origin !== undefined) headers.set("origin", origin);
  if (fetchSite !== undefined) headers.set("sec-fetch-site", fetchSite);
  return new Request(url, { method: "POST", headers });
}

describe("same-origin mutation guard", () => {
  it("accepts an exact same-origin browser mutation", () => {
    expect(isSameOriginRequest(mutationRequest(
      "https://desertartgallery.net/api/cart/sync",
      "https://desertartgallery.net",
      "same-origin",
    ))).toBe(true);
  });

  it("rejects requests without an Origin header", () => {
    expect(isSameOriginRequest(mutationRequest("https://desertartgallery.net/api/cart/sync"))).toBe(false);
  });

  it("rejects a different origin even when it is same-site", () => {
    expect(isSameOriginRequest(mutationRequest(
      "https://desertartgallery.net/api/cart/sync",
      "https://attacker.desertartgallery.net",
      "same-site",
    ))).toBe(false);
  });

  it("rejects an Origin value containing a path", () => {
    expect(isSameOriginRequest(mutationRequest(
      "https://desertartgallery.net/api/cart/sync",
      "https://desertartgallery.net/path",
    ))).toBe(false);
  });

  it("rejects a cross-site fetch metadata value", () => {
    expect(isSameOriginRequest(mutationRequest(
      "https://desertartgallery.net/api/cart/sync",
      "https://desertartgallery.net",
      "cross-site",
    ))).toBe(false);
  });

  it("normalizes default ports when comparing origins", () => {
    expect(isSameOriginRequest(mutationRequest(
      "https://desertartgallery.net:443/api/cart/sync",
      "https://desertartgallery.net",
    ))).toBe(true);
  });
});
