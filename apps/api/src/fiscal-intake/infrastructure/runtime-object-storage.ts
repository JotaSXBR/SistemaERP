import { createHash } from "node:crypto";

import { ServiceUnavailableException, type OnApplicationShutdown } from "@nestjs/common";

import {
  ObjectStorageConflictError,
  ObjectStorageObjectNotFoundError,
  type ObjectStorage,
  type ObjectStorageObjectReference,
  type PutObjectInput,
  type StoredObject,
  type StoredObjectMetadata,
} from "../application/object-storage.js";
import { S3ObjectStorageAdapter } from "./s3-object-storage.adapter.js";

export const OBJECT_STORAGE = Symbol("OBJECT_STORAGE");

export function createRuntimeObjectStorage(
  environment: NodeJS.ProcessEnv = process.env,
): ObjectStorage {
  if (environment.NODE_ENV === "test") {
    return new InMemoryObjectStorage();
  }
  if (environment.NODE_ENV === "production") {
    return new UnavailableObjectStorage();
  }

  return new LazyS3ObjectStorage(environment);
}

class UnavailableObjectStorage implements ObjectStorage {
  get(reference: ObjectStorageObjectReference): Promise<StoredObject> {
    void reference;
    return Promise.reject(storageNotConfigured());
  }

  head(reference: ObjectStorageObjectReference): Promise<StoredObjectMetadata | null> {
    void reference;
    return Promise.reject(storageNotConfigured());
  }

  put(input: PutObjectInput): Promise<StoredObjectMetadata> {
    void input;
    return Promise.reject(storageNotConfigured());
  }
}

function storageNotConfigured(): ServiceUnavailableException {
  return new ServiceUnavailableException("Organization object storage is not configured");
}

class LazyS3ObjectStorage implements ObjectStorage, OnApplicationShutdown {
  private adapter?: S3ObjectStorageAdapter;

  constructor(private readonly environment: NodeJS.ProcessEnv) {}

  get(reference: ObjectStorageObjectReference): Promise<StoredObject> {
    return this.getAdapter().get(reference);
  }

  head(reference: ObjectStorageObjectReference): Promise<StoredObjectMetadata | null> {
    return this.getAdapter().head(reference);
  }

  put(input: PutObjectInput): Promise<StoredObjectMetadata> {
    return this.getAdapter().put(input);
  }

  onApplicationShutdown(): void {
    this.adapter?.destroy();
  }

  private getAdapter(): S3ObjectStorageAdapter {
    if (this.adapter) {
      return this.adapter;
    }

    const accessKeyId =
      this.environment.S3_ACCESS_KEY_ID?.trim() ||
      this.environment.MINIO_APP_USER?.trim() ||
      "sistema_erp_app";
    const bucket = this.environment.S3_BUCKET?.trim() || this.environment.MINIO_BUCKET?.trim();
    const endpoint =
      this.environment.S3_ENDPOINT?.trim() ||
      `http://127.0.0.1:${this.environment.MINIO_API_PORT?.trim() || "9000"}`;
    const region = this.environment.S3_REGION?.trim() || "us-east-1";
    const secretAccessKey =
      this.environment.S3_SECRET_ACCESS_KEY?.trim() ||
      this.environment.MINIO_APP_PASSWORD?.trim() ||
      "local_minio_app_only";
    if (!accessKeyId || !bucket || !endpoint || !region || !secretAccessKey) {
      throw new ServiceUnavailableException("Private object storage is not configured");
    }

    this.adapter = new S3ObjectStorageAdapter({
      accessKeyId,
      bucket,
      endpoint,
      forcePathStyle: this.environment.S3_FORCE_PATH_STYLE !== "false",
      region,
      secretAccessKey,
      ...(this.environment.S3_SESSION_TOKEN?.trim()
        ? { sessionToken: this.environment.S3_SESSION_TOKEN.trim() }
        : {}),
    });
    return this.adapter;
  }
}

class InMemoryObjectStorage implements ObjectStorage {
  private readonly objects = new Map<string, StoredObject>();

  get(reference: ObjectStorageObjectReference): Promise<StoredObject> {
    const stored = this.objects.get(reference.key);
    if (!stored || (reference.versionId && stored.versionId !== reference.versionId)) {
      return Promise.reject(new ObjectStorageObjectNotFoundError(reference.key));
    }

    return Promise.resolve({ ...stored, body: stored.body.slice() });
  }

  head(reference: ObjectStorageObjectReference): Promise<StoredObjectMetadata | null> {
    const stored = this.objects.get(reference.key);
    if (!stored || (reference.versionId && stored.versionId !== reference.versionId)) {
      return Promise.resolve(null);
    }

    return Promise.resolve(objectMetadata(stored));
  }

  put(input: PutObjectInput): Promise<StoredObjectMetadata> {
    const existing = this.objects.get(input.key);
    if (existing) {
      if (
        existing.sha256 !== input.sha256 ||
        existing.contentType !== input.contentType ||
        existing.contentLength !== input.body.byteLength
      ) {
        return Promise.reject(new ObjectStorageConflictError(input.key));
      }

      return Promise.resolve(objectMetadata(existing));
    }

    const actualHash = createHash("sha256").update(input.body).digest("hex");
    if (actualHash !== input.sha256) {
      return Promise.reject(new ObjectStorageConflictError(input.key));
    }

    const stored: StoredObject = {
      body: input.body.slice(),
      contentLength: input.body.byteLength,
      contentType: input.contentType,
      key: input.key,
      sha256: input.sha256,
      versionId: createHash("sha256").update(`${input.key}:${input.sha256}`).digest("hex"),
    };
    this.objects.set(input.key, stored);
    return Promise.resolve(objectMetadata(stored));
  }
}

function objectMetadata(stored: StoredObject): StoredObjectMetadata {
  return {
    contentLength: stored.contentLength,
    contentType: stored.contentType,
    ...(stored.eTag ? { eTag: stored.eTag } : {}),
    key: stored.key,
    ...(stored.lastModified ? { lastModified: stored.lastModified } : {}),
    sha256: stored.sha256,
    ...(stored.versionId ? { versionId: stored.versionId } : {}),
  };
}
