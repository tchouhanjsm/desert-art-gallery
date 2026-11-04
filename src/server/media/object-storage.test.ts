import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import {
  createS3MediaAdapter,
  getMediaStorageDriver,
  readMediaStorageConfig,
  type S3CommandSender,
} from "./object-storage";

describe("S3-compatible private media storage", () => {
  it("defaults to local filesystem storage", () => {
    expect(getMediaStorageDriver({} as NodeJS.ProcessEnv)).toBe("local");
    expect(getMediaStorageDriver({ MEDIA_STORAGE_DRIVER: "local" } as NodeJS.ProcessEnv)).toBe("local");
  });

  it("rejects unknown storage drivers and unsafe endpoint URLs", () => {
    expect(() => getMediaStorageDriver({ MEDIA_STORAGE_DRIVER: "public" } as NodeJS.ProcessEnv)).toThrow(/MEDIA_STORAGE_DRIVER/i);
    const valid = {
      MEDIA_S3_ENDPOINT: "https://abc.r2.cloudflarestorage.com",
      MEDIA_S3_BUCKET: "gallery-private",
      MEDIA_S3_ACCESS_KEY_ID: "test-access-key",
      MEDIA_S3_SECRET_ACCESS_KEY: "test-secret-key",
    } as NodeJS.ProcessEnv;
    expect(() => readMediaStorageConfig(valid)).toThrow(/MEDIA_S3_ENDPOINT is required/i);
    expect(() => readMediaStorageConfig({
      ...valid,
      MEDIA_S3_ENDPOINT: "http://abc.r2.cloudflarestorage.com",
    } as NodeJS.ProcessEnv)).toThrow(/HTTPS/i);
  });

  it("requires a complete S3 endpoint, private bucket identity and credentials", () => {
    expect(readMediaStorageConfig({
      MEDIA_S3_ENDPOINT: "https://abc.r2.cloudflarestorage.com",
      MEDIA_S3_BUCKET: "gallery-private",
      MEDIA_S3_ACCESS_KEY_ID: "test-access-key",
      MEDIA_S3_SECRET_ACCESS_KEY: "test-secret-key",
    } as NodeJS.ProcessEnv)).toEqual({
      endpoint: "https://abc.r2.cloudflarestorage.com",
      region: "auto",
      bucket: "gallery-private",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
    });
  });

  it("uploads private, typed objects and reads/deletes them without public URLs", async () => {
    const records = new Map<string, { bytes: Buffer; contentType: string; cacheControl: string }>();
    const send = vi.fn<S3CommandSender>(async (command) => {
      if (command instanceof PutObjectCommand) {
        records.set(command.input.Key ?? "", {
          bytes: Buffer.from(command.input.Body as Uint8Array),
          contentType: command.input.ContentType ?? "",
          cacheControl: command.input.CacheControl ?? "",
        });
        return {};
      }
      if (command instanceof GetObjectCommand) {
        const value = records.get(command.input.Key ?? "");
        if (!value) {
          const error = new Error("missing");
          error.name = "NoSuchKey";
          throw error;
        }
        return {
          Body: {
            transformToByteArray: async () => new Uint8Array(value.bytes),
          },
          ContentType: value.contentType,
        };
      }
      if (command instanceof DeleteObjectCommand) {
        records.delete(command.input.Key ?? "");
        return {};
      }
      throw new Error("Unexpected S3 command.");
    });
    const adapter = createS3MediaAdapter(send, "gallery-private");
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x01]);

    await adapter.put({ key: "products/product-id/image.jpg", bytes, contentType: "image/jpeg" });
    expect(records.get("products/product-id/image.jpg")).toMatchObject({
      bytes: Buffer.from(bytes),
      contentType: "image/jpeg",
      cacheControl: "private, no-store",
    });
    expect(await adapter.get({ key: "products/product-id/image.jpg" })).toEqual(Buffer.from(bytes));
    expect(await adapter.get({ key: "products/missing/image.jpg" })).toBeNull();
    await adapter.delete({ key: "products/product-id/image.jpg" });
    expect(records.has("products/product-id/image.jpg")).toBe(false);
  });

  it("does not swallow non-not-found storage errors", async () => {
    const send = vi.fn<S3CommandSender>(async () => {
      throw new Error("network failure");
    });
    const adapter = createS3MediaAdapter(send, "gallery-private");
    await expect(adapter.get({ key: "products/product-id/image.jpg" })).rejects.toThrow("network failure");
  });
});
