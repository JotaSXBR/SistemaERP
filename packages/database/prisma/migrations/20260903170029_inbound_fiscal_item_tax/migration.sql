-- CreateTable
CREATE TABLE "inbound_fiscal_document_item_taxes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "document_item_id" UUID NOT NULL,
    "origin" VARCHAR(1),
    "icms_cst" VARCHAR(2),
    "icms_csosn" VARCHAR(3),
    "icms_benefit_code" VARCHAR(10),
    "icms_base" DECIMAL(24,4),
    "icms_rate" DECIMAL(9,4),
    "icms_value" DECIMAL(24,4),
    "icms_base_reduction_rate" DECIMAL(9,4),
    "icms_st_base" DECIMAL(24,4),
    "icms_st_value" DECIMAL(24,4),
    "ipi_cst" VARCHAR(2),
    "ipi_rate" DECIMAL(9,4),
    "ipi_value" DECIMAL(24,4),
    "pis_cst" VARCHAR(2),
    "pis_value" DECIMAL(24,4),
    "cofins_cst" VARCHAR(2),
    "cofins_value" DECIMAL(24,4),
    "ibs_cbs_cst" VARCHAR(3),
    "ibs_cbs_classification" VARCHAR(6),
    "ibs_cbs_base" DECIMAL(24,4),
    "ibs_value" DECIMAL(24,4),
    "cbs_value" DECIMAL(24,4),
    "approximate_tax_value" DECIMAL(24,4),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_fiscal_document_item_taxes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inbound_fiscal_document_item_taxes_id_organization_id_key" ON "inbound_fiscal_document_item_taxes"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_fiscal_document_item_taxes_document_item_id_organiz_key" ON "inbound_fiscal_document_item_taxes"("document_item_id", "organization_id");

-- AddForeignKey
ALTER TABLE "inbound_fiscal_document_item_taxes" ADD CONSTRAINT "inbound_fiscal_document_item_taxes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_fiscal_document_item_taxes" ADD CONSTRAINT "inbound_fiscal_document_item_taxes_document_item_id_organi_fkey" FOREIGN KEY ("document_item_id", "organization_id") REFERENCES "inbound_fiscal_document_items"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
