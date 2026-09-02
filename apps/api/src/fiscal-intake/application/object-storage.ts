export interface ObjectStorageObjectReference {
  key: string;
  versionId?: string;
}

export interface StoredObjectMetadata extends ObjectStorageObjectReference {
  contentLength: number;
  contentType: string;
  eTag?: string;
  lastModified?: Date;
  sha256: string;
}

export interface StoredObject extends StoredObjectMetadata {
  body: Uint8Array;
}

export interface PutObjectInput {
  body: Uint8Array;
  contentType: string;
  key: string;
  sha256: string;
}

export interface ObjectStorage {
  get(reference: ObjectStorageObjectReference): Promise<StoredObject>;
  head(reference: ObjectStorageObjectReference): Promise<StoredObjectMetadata | null>;
  put(input: PutObjectInput): Promise<StoredObjectMetadata>;
}

export class ObjectStorageConflictError extends Error {
  constructor(key: string) {
    super(`Object key already contains different content: ${key}`);
    this.name = "ObjectStorageConflictError";
  }
}

export class ObjectStorageIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ObjectStorageIntegrityError";
  }
}

export class ObjectStorageObjectNotFoundError extends Error {
  constructor(key: string) {
    super(`Object not found: ${key}`);
    this.name = "ObjectStorageObjectNotFoundError";
  }
}
