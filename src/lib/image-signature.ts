const readAscii = (bytes: Uint8Array, start: number, end: number) =>
  Array.from(bytes.slice(start, end), (byte) => String.fromCharCode(byte)).join("");

export function hasSupportedImageSignature(contentType: string, bytes: Uint8Array): boolean {
  switch (contentType) {
    case "image/jpeg":
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return bytes.length >= 8 && readAscii(bytes, 0, 8) === "\x89PNG\r\n\x1a\n";
    case "image/webp":
      return bytes.length >= 12 && readAscii(bytes, 0, 4) === "RIFF" && readAscii(bytes, 8, 12) === "WEBP";
    case "image/avif": {
      if (bytes.length < 16 || readAscii(bytes, 4, 8) !== "ftyp") return false;
      const brands = [readAscii(bytes, 8, 12)];
      for (let offset = 16; offset + 4 <= bytes.length; offset += 4) {
        brands.push(readAscii(bytes, offset, offset + 4));
      }
      return brands.some((brand) => brand === "avif" || brand === "avis");
    }
    default:
      return false;
  }
}
