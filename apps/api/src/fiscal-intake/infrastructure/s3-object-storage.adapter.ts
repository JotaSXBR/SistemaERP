import { createHash } from "node:crypto";

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectOutput,
  type HeadObjectOutput,
} from "@aws-sdk/client-s3";

import {
  ObjectStorageConflictError,
  ObjectStorageIntegrityError,
  ObjectStorageObjectNotFoundError,
  type ObjectStorage,
  type ObjectStorageObjectReference,
  type PutObjectInput,
  type StoredObject,
  type StoredObjectMetadata,
} from "../application/object-storage.js";

export interface S3ObjectStorageConfiguration {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  forcePathStyle: boolean;
  region: string;
  secretAccessKey: string;
  sessionToken?: string;
}

type ObjectResponse = Pick<
  HeadObjectOutput,
  | "ChecksumSHA256"
  | "ContentLength"
  | "ContentType"
  | "ETag"
  | "LastModified"
  | "Metadata"
  | "VersionId"
>;

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

export class S3ObjectStorageAdapter implements ObjectStorage {
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor(configuration: S3ObjectStorageConfiguration) {
    this.bucket = configuration.bucket;
    this.client = new S3Client({
      credentials: {
        accessKeyId: configuration.accessKeyId,
        secretAccessKey: configuration.secretAccessKey,
        ...(configuration.sessionToken === undefined
          ? {}
          : { sessionToken: configuration.sessionToken }),
      },
      endpoint: configuration.endpoint,
      forcePathStyle: configuration.forcePathStyle,
      region: configuration.region,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  destroy(): void {
    this.client.destroy();
  }

  async put(input: PutObjectInput): Promise<StoredObjectMetadata> {
    validatePutInput(input);
    const checksumSha256 = Buffer.from(input.sha256, "hex").toString("base64");

    try {
      const response = await this.client.send(
        new PutObjectCommand({
          Body: input.body,
          Bucket: this.bucket,
          ChecksumSHA256: checksumSha256,
          ContentLength: input.body.byteLength,
          ContentType: input.contentType,
          IfNoneMatch: "*",
          Key: input.key,
          Metadata: { sha256: input.sha256 },
        }),
      );

      return {
        contentLength: input.body.byteLength,
        contentType: input.contentType,
        ...(response.ETag === undefined ? {} : { eTag: response.ETag }),
        key: input.key,
        sha256: input.sha256,
        ...(response.VersionId === undefined ? {} : { versionId: response.VersionId }),
      };
    } catch (error) {
      if (!isPreconditionFailed(error)) {
        throw error;
      }

      const existing = await this.head({ key: input.key });
      if (
        existing?.contentLength === input.body.byteLength &&
        existing.contentType === input.contentType &&
        existing.sha256 === input.sha256
      ) {
        return existing;
      }

      throw new ObjectStorageConflictError(input.key);
    }
  }

  async head(reference: ObjectStorageObjectReference): Promise<StoredObjectMetadata | null> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          ChecksumMode: "ENABLED",
          Key: reference.key,
          ...(reference.versionId === undefined ? {} : { VersionId: reference.versionId }),
        }),
      );

      return mapMetadata(reference.key, response);
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }

      throw error;
    }
  }

  async get(reference: ObjectStorageObjectReference): Promise<StoredObject> {
    let response: GetObjectOutput;
    try {
      response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          ChecksumMode: "ENABLED",
          Key: reference.key,
          ...(reference.versionId === undefined ? {} : { VersionId: reference.versionId }),
        }),
      );
    } catch (error) {
      if (isNotFound(error)) {
        throw new ObjectStorageObjectNotFoundError(reference.key);
      }

      throw error;
    }

    if (!hasTransformToByteArray(response.Body)) {
      throw new ObjectStorageIntegrityError(`Object body is missing: ${reference.key}`);
    }

    const metadata = mapMetadata(reference.key, response);
    const body = await response.Body.transformToByteArray();
    const actualSha256 = createHash("sha256").update(body).digest("hex");
    if (actualSha256 !== metadata.sha256 || body.byteLength !== metadata.contentLength) {
      throw new ObjectStorageIntegrityError(
        `Object content failed integrity validation: ${reference.key}`,
      );
    }

    return { ...metadata, body };
  }
}

function validatePutInput(input: PutObjectInput): void {
  const actualSha256 = createHash("sha256").update(input.body).digest("hex");
  if (!SHA256_HEX_PATTERN.test(input.sha256) || actualSha256 !== input.sha256) {
    throw new ObjectStorageIntegrityError(`Object SHA-256 does not match its body: ${input.key}`);
  }
}

function mapMetadata(key: string, response: ObjectResponse): StoredObjectMetadata {
  const sha256 = response.Metadata?.["sha256"];
  if (
    response.ContentLength === undefined ||
    response.ContentType === undefined ||
    sha256 === undefined ||
    !SHA256_HEX_PATTERN.test(sha256)
  ) {
    throw new ObjectStorageIntegrityError(`Object metadata is incomplete: ${key}`);
  }

  if (response.ChecksumSHA256 !== undefined) {
    const expectedChecksum = Buffer.from(sha256, "hex").toString("base64");
    if (response.ChecksumSHA256 !== expectedChecksum) {
      throw new ObjectStorageIntegrityError(`Object checksum metadata does not match: ${key}`);
    }
  }

  return {
    contentLength: response.ContentLength,
    contentType: response.ContentType,
    ...(response.ETag === undefined ? {} : { eTag: response.ETag }),
    key,
    ...(response.LastModified === undefined ? {} : { lastModified: response.LastModified }),
    sha256,
    ...(response.VersionId === undefined ? {} : { versionId: response.VersionId }),
  };
}

function isNotFound(error: unknown): boolean {
  return (
    hasS3ErrorShape(error) &&
    (error.name === "NotFound" ||
      error.name === "NoSuchKey" ||
      error.$metadata.httpStatusCode === 404)
  );
}

function isPreconditionFailed(error: unknown): boolean {
  return (
    hasS3ErrorShape(error) &&
    (error.name === "PreconditionFailed" || error.$metadata.httpStatusCode === 412)
  );
}

function hasS3ErrorShape(
  error: unknown,
): error is { $metadata: { httpStatusCode?: number }; name: string } {
  return (
    error instanceof Error &&
    "$metadata" in error &&
    typeof error.$metadata === "object" &&
    error.$metadata !== null
  );
}

function hasTransformToByteArray(
  body: unknown,
): body is { transformToByteArray(): Promise<Uint8Array> } {
  return (
    typeof body === "object" &&
    body !== null &&
    "transformToByteArray" in body &&
    typeof body.transformToByteArray === "function"
  );
}
