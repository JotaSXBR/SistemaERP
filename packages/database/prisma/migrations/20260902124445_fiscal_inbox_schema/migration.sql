-- CreateEnum
CREATE TYPE "FiscalDocumentStatus" AS ENUM ('PENDING_VALIDATION', 'VALIDATION_FAILED', 'PENDING_MAPPING', 'READY_FOR_REVIEW');

-- CreateEnum
CREATE TYPE "FiscalIngestionSource" AS ENUM ('MANUAL_UPLOAD');

-- CreateTable
CREATE TABLE "inbound_fiscal_documents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "access_key" VARCHAR(44) NOT NULL,
    "status" "FiscalDocumentStatus" NOT NULL DEFAULT 'PENDING_VALIDATION',
    "schema_version" VARCHAR(10) NOT NULL,
    "document_number" VARCHAR(20) NOT NULL,
    "series" VARCHAR(10) NOT NULL,
    "protocol" VARCHAR(32),
    "issued_at" TIMESTAMPTZ(3) NOT NULL,
    "supplier_tax_id" VARCHAR(32) NOT NULL,
    "supplier_name" VARCHAR(160) NOT NULL,
    "recipient_tax_id" VARCHAR(32) NOT NULL,
    "nature_of_operation" VARCHAR(255) NOT NULL,
    "document_total" DECIMAL(24,4) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inbound_fiscal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_fiscal_document_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "item_number" VARCHAR(16) NOT NULL,
    "supplier_code" VARCHAR(120) NOT NULL,
    "description" VARCHAR(240) NOT NULL,
    "ncm" VARCHAR(8) NOT NULL,
    "cest" VARCHAR(7),
    "gtin" VARCHAR(14),
    "cfop" VARCHAR(4) NOT NULL,
    "commercial_unit" VARCHAR(16) NOT NULL,
    "commercial_quantity" DECIMAL(24,10) NOT NULL,
    "commercial_unit_value" DECIMAL(24,10) NOT NULL,
    "taxable_unit" VARCHAR(16) NOT NULL,
    "taxable_quantity" DECIMAL(24,10) NOT NULL,
    "taxable_unit_value" DECIMAL(24,10) NOT NULL,
    "total_value" DECIMAL(24,4) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_fiscal_document_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_document_ingestions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "source" "FiscalIngestionSource" NOT NULL,
    "hash_sha256" VARCHAR(64) NOT NULL,
    "object_key" VARCHAR(1024) NOT NULL,
    "object_version_id" VARCHAR(1024),
    "content_type" VARCHAR(100) NOT NULL,
    "byte_size" BIGINT NOT NULL,
    "request_id" VARCHAR(80) NOT NULL,
    "correlation_id" VARCHAR(128) NOT NULL,
    "ingested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_document_ingestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_fiscal_document_item_mappings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_item_id" UUID NOT NULL,
    "product_presentation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_fiscal_document_item_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inbound_fiscal_documents_organization_id_status_created_at_idx" ON "inbound_fiscal_documents"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "inbound_fiscal_documents_organization_id_supplier_tax_id_is_idx" ON "inbound_fiscal_documents"("organization_id", "supplier_tax_id", "issued_at");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_fiscal_documents_id_organization_id_key" ON "inbound_fiscal_documents"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_fiscal_documents_organization_id_access_key_key" ON "inbound_fiscal_documents"("organization_id", "access_key");

-- CreateIndex
CREATE INDEX "inbound_fiscal_document_items_organization_id_supplier_code_idx" ON "inbound_fiscal_document_items"("organization_id", "supplier_code");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_fiscal_document_items_id_organization_id_key" ON "inbound_fiscal_document_items"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_fiscal_document_items_organization_id_document_id_i_key" ON "inbound_fiscal_document_items"("organization_id", "document_id", "item_number");

-- CreateIndex
CREATE INDEX "fiscal_document_ingestions_organization_id_ingested_at_idx" ON "fiscal_document_ingestions"("organization_id", "ingested_at");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_document_ingestions_id_organization_id_key" ON "fiscal_document_ingestions"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_document_ingestions_organization_id_document_id_hash_key" ON "fiscal_document_ingestions"("organization_id", "document_id", "hash_sha256");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_document_ingestions_organization_id_object_key_key" ON "fiscal_document_ingestions"("organization_id", "object_key");

-- CreateIndex
CREATE INDEX "inbound_fiscal_document_item_mappings_organization_id_produ_idx" ON "inbound_fiscal_document_item_mappings"("organization_id", "product_presentation_id");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_fiscal_document_item_mappings_id_organization_id_key" ON "inbound_fiscal_document_item_mappings"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_fiscal_document_item_mappings_document_item_id_orga_key" ON "inbound_fiscal_document_item_mappings"("document_item_id", "organization_id");

-- RenameForeignKey
ALTER TABLE "supplier_product_mappings" RENAME CONSTRAINT "supplier_product_mappings_product_presentation_id_organization_" TO "supplier_product_mappings_product_presentation_id_organiza_fkey";

-- AddForeignKey
ALTER TABLE "inbound_fiscal_documents" ADD CONSTRAINT "inbound_fiscal_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_fiscal_document_items" ADD CONSTRAINT "inbound_fiscal_document_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_fiscal_document_items" ADD CONSTRAINT "inbound_fiscal_document_items_document_id_organization_id_fkey" FOREIGN KEY ("document_id", "organization_id") REFERENCES "inbound_fiscal_documents"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_document_ingestions" ADD CONSTRAINT "fiscal_document_ingestions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_document_ingestions" ADD CONSTRAINT "fiscal_document_ingestions_document_id_organization_id_fkey" FOREIGN KEY ("document_id", "organization_id") REFERENCES "inbound_fiscal_documents"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_fiscal_document_item_mappings" ADD CONSTRAINT "inbound_fiscal_document_item_mappings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_fiscal_document_item_mappings" ADD CONSTRAINT "inbound_fiscal_document_item_mappings_document_item_id_org_fkey" FOREIGN KEY ("document_item_id", "organization_id") REFERENCES "inbound_fiscal_document_items"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_fiscal_document_item_mappings" ADD CONSTRAINT "inbound_fiscal_document_item_mappings_product_presentation_fkey" FOREIGN KEY ("product_presentation_id", "organization_id") REFERENCES "product_presentations"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "supplier_product_mappings_organization_id_product_presentation_" RENAME TO "supplier_product_mappings_organization_id_product_presentat_idx";

-- RenameIndex
ALTER INDEX "supplier_product_mappings_organization_id_supplier_id_normalize" RENAME TO "supplier_product_mappings_organization_id_supplier_id_norma_key";
