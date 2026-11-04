import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export type MediaStorageDriver = "local" | "s3";
export type MediaContentType = "image/jpeg" | "image/png" | "image/webp" | "image/avif";

export type MediaStorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

type S3Command = PutObjectCommand | GetObjectCommand | DeleteObjectCommand;
export type S3CommandSender = (command: S3Command) => Promise<unknown>;

export type S3MediaAdapter = {
  put(input: { key: string; bytes: Uint8Array; contentType: MediaContentType }): Promise<void>;
  get(input: { key: string }): Promise<Buffer | null>;
  delete(input: { key: string }): Promise<void>;
};

function assertSafeObjectKey(key: string): string {
  if (!key || key.length > 512 || key.startsWith("/") || key.includes("\\") || key.includes("\0")) {
    throw new Error("Private media object key is invalid.");
  }
  const segments = key.split("/");
  if (segments.length < 3 || segments.some((segment) =>
    !segment || segment === "." || segment === ".." || !/^[a-zA-Z0-9._-]+$/.test(segment)
  )) {
    throw new Error("Private media object key is invalid.");
  }
  if (segments[0] !== "products" && segments[0] !== "editorial") {
    throw new Error("Private media object key is outside an approved namespace.");
  }
  return segments.join("/");
}

type GetObjectOutput = {
  Body?: Uint8Array | { transformToByteArray?: () => Promise<Uint8Array> } | null;
};

function requiredEnvironmentValue(value: string | undefined, label: string): string {
  const resolved = value?.trim();
  if (!resolved) throw new Error(label + " is required when MEDIA_STORAGE_DRIVER=s3.");
  return resolved;
}

export function getMediaStorageDriver(
  environment: NodeJS.ProcessEnv = process.env,
): MediaStorageDriver {
  const value = (environment.MEDIA_STORAGE_DRIVER ?? "local").trim().toLowerCase();
  if (value !== "local" && value !== "s3") {
    throw new Error("MEDIA_STORAGE_DRIVER must be either local or s3.");
  }
  return value;
}

export function readMediaStorageConfig(
  environment: NodeJS.ProcessEnv = process.env,
): MediaStorageConfig {
  const endpoint = requiredEnvironmentValue(environment.MEDIA_S3_ENDPOINT, "MEDIA_S3_ENDPOINT");
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error("MEDIA_S3_ENDPOINT must be a valid HTTPS URL.");
  }
  if (
    parsed.protocol !== "https:" ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  ) {
    throw new Error("MEDIA_S3_ENDPOINT must be an HTTPS origin without credentials, path, query or fragment.");
  }

  const bucket = requiredEnvironmentValue(environment.MEDIA_S3_BUCKET, "MEDIA_S3_BUCKET");
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) || bucket.includes("..")) {
    throw new Error("MEDIA_S3_BUCKET must be a valid lowercase S3 bucket name.");
  }
  const region = (environment.MEDIA_S3_REGION ?? "auto").trim() || "auto";
  return {
    endpoint: parsed.origin,
    region,
    bucket,
    accessKeyId: requiredEnvironmentValue(environment.MEDIA_S3_ACCESS_KEY_ID, "MEDIA_S3_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnvironmentValue(environment.MEDIA_S3_SECRET_ACCESS_KEY, "MEDIA_S3_SECRET_ACCESS_KEY"),
  };
}

function isObjectNotFound(error: unknown): boolean {
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } } | null;
  return candidate?.name === "NoSuchKey" ||
    candidate?.name === "NotFound" ||
    candidate?.$metadata?.httpStatusCode === 404;
}

export function createS3MediaAdapter(
  send: S3CommandSender,
  bucket: string,
): S3MediaAdapter {
  return {
    async put({ key, bytes, contentType }) {
      const safeKey = assertSafeObjectKey(key);
      await send(new PutObjectCommand({
        Bucket: bucket,
        Key: safeKey,
        Body: Buffer.from(bytes),
        ContentLength: bytes.byteLength,
        ContentType: contentType,
        CacheControl: "private, no-store",
      }));
    },
    async get({ key }) {
      const safeKey = assertSafeObjectKey(key);
      let response: GetObjectOutput;
      try {
        response = await send(new GetObjectCommand({ Bucket: bucket, Key: safeKey })) as GetObjectOutput;
      } catch (error) {
        if (isObjectNotFound(error)) return null;
        throw error;
      }
      const body = response.Body;
      if (!body) return null;
      if (body instanceof Uint8Array) return Buffer.from(body);
      if (typeof body.transformToByteArray === "function") {
        return Buffer.from(await body.transformToByteArray());
      }
      throw new Error("The S3-compatible media store returned an unsupported object stream.");
    },
    async delete({ key }) {
      const safeKey = assertSafeObjectKey(key);
      await send(new DeleteObjectCommand({ Bucket: bucket, Key: safeKey }));
    },
  };
}

let cachedClient: S3Client | undefined;
let cachedAdapter: S3MediaAdapter | undefined;
let cachedFingerprint: string | undefined;

function getS3MediaAdapter(): S3MediaAdapter {
  const config = readMediaStorageConfig();
  const fingerprint = createHash("sha256")
    .update(config.endpoint)
    .update("\0")
    .update(config.region)
    .update("\0")
    .update(config.bucket)
    .update("\0")
    .update(config.accessKeyId)
    .update("\0")
    .update(config.secretAccessKey)
    .digest("hex");

  if (!cachedAdapter || cachedFingerprint !== fingerprint) {
    cachedClient?.destroy();
    const client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    cachedClient = client;
    cachedAdapter = createS3MediaAdapter(
      (command) => client.send(command as never),
      config.bucket,
    );
    cachedFingerprint = fingerprint;
  }
  return cachedAdapter;
}

function localPath(input: string | undefined): string {
  if (!input || !path.isAbsolute(input)) {
    throw new Error("An absolute local media path is required for filesystem media storage.");
  }
  return path.resolve(input);
}

async function writeLocalObject(destinationPath: string, bytes: Uint8Array): Promise<void> {
  const directory = path.dirname(destinationPath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = destinationPath + "." + randomUUID() + ".tmp";
  try {
    await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
    await rename(temporary, destinationPath);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function storePrivateMediaObject(input: {
  key: string;
  bytes: Uint8Array;
  contentType: MediaContentType;
  localPath?: string;
}): Promise<void> {
  if (getMediaStorageDriver() === "s3") {
    await getS3MediaAdapter().put(input);
    return;
  }
  await writeLocalObject(localPath(input.localPath), input.bytes);
}

export async function readPrivateMediaObject(input: {
  key: string;
  contentType: MediaContentType;
  localPath?: string;
}): Promise<{ bytes: Buffer; mimeType: MediaContentType } | null> {
  if (getMediaStorageDriver() === "s3") {
    const bytes = await getS3MediaAdapter().get({ key: input.key });
    return bytes ? { bytes, mimeType: input.contentType } : null;
  }
  try {
    return {
      bytes: await readFile(localPath(input.localPath)),
      mimeType: input.contentType,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function removePrivateMediaObject(input: {
  key: string;
  localPath?: string;
}): Promise<void> {
  if (getMediaStorageDriver() === "s3") {
    await getS3MediaAdapter().delete({ key: input.key });
    return;
  }
  await rm(localPath(input.localPath), { force: true });
}

export function resetS3MediaClientForTests(): void {
  cachedClient?.destroy();
  cachedClient = undefined;
  cachedAdapter = undefined;
  cachedFingerprint = undefined;
}
