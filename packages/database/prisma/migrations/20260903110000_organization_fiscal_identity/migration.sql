CREATE TYPE "FiscalDocumentValidationIssue" AS ENUM (
  'ORGANIZATION_TAX_ID_NOT_CONFIGURED',
  'RECIPIENT_TAX_ID_MISMATCH'
);

ALTER TABLE "organizations"
ADD COLUMN "fiscal_tax_id" VARCHAR(32);

ALTER TABLE "inbound_fiscal_documents"
ADD COLUMN "validation_issues" "FiscalDocumentValidationIssue"[] NOT NULL DEFAULT ARRAY[]::"FiscalDocumentValidationIssue"[];

ALTER TABLE "organizations"
ADD CONSTRAINT "organizations_fiscal_tax_id_check"
CHECK (
  "fiscal_tax_id" IS NULL
  OR "fiscal_tax_id" ~ '^[A-Z0-9]{11,32}$'
);
