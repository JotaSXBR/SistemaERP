ALTER TYPE "FiscalDocumentStatus" ADD VALUE 'PENDING_SUPPLIER' BEFORE 'PENDING_MAPPING';

ALTER TABLE "fiscal_document_ingestions"
ADD COLUMN "idempotency_key_hash" VARCHAR(64);

UPDATE "fiscal_document_ingestions"
SET "idempotency_key_hash" = encode(
  sha256(convert_to("organization_id"::text || ':' || "id"::text, 'UTF8')),
  'hex'
);

ALTER TABLE "fiscal_document_ingestions"
ALTER COLUMN "idempotency_key_hash" SET NOT NULL,
ADD CONSTRAINT "fiscal_document_ingestions_idempotency_key_hash_check"
CHECK ("idempotency_key_hash" ~ '^[0-9a-f]{64}$');

CREATE UNIQUE INDEX "fiscal_document_ingestions_organization_id_idempotency_key_hash_key"
ON "fiscal_document_ingestions"("organization_id", "idempotency_key_hash");
