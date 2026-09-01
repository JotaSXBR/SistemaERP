-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('ORGANIZATION', 'PERSON');

-- CreateEnum
CREATE TYPE "PartnerRole" AS ENUM ('SUPPLIER', 'CUSTOMER', 'CARRIER');

-- CreateEnum
CREATE TYPE "ProductConversionMode" AS ENUM ('FIXED', 'VARIABLE');

-- CreateTable
CREATE TABLE "partners" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "type" "PartnerType" NOT NULL,
    "legal_name" VARCHAR(160) NOT NULL,
    "trade_name" VARCHAR(160),
    "tax_id" VARCHAR(32) NOT NULL,
    "roles" "PartnerRole"[] NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "partners_tax_id_format_check" CHECK ("tax_id" ~ '^[A-Z0-9]{11,32}$'),
    CONSTRAINT "partners_roles_not_empty_check" CHECK (cardinality("roles") > 0)
);

-- CreateTable
CREATE TABLE "units_of_measure" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "decimal_scale" INTEGER NOT NULL DEFAULT 4,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "units_of_measure_code_not_empty_check" CHECK (length("code") > 0),
    CONSTRAINT "units_of_measure_decimal_scale_check" CHECK ("decimal_scale" BETWEEN 0 AND 10)
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "sku" VARCHAR(80) NOT NULL,
    "short_description" VARCHAR(240) NOT NULL,
    "technical_description" TEXT,
    "base_unit_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "products_sku_not_empty_check" CHECK (length("sku") > 0)
);

-- CreateTable
CREATE TABLE "product_presentations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "unit_of_measure_id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "conversion_mode" "ProductConversionMode" NOT NULL,
    "conversion_factor" DECIMAL(24,10),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_presentations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_presentations_code_not_empty_check" CHECK (length("code") > 0),
    CONSTRAINT "product_presentations_conversion_check" CHECK (
        ("conversion_mode" = 'FIXED' AND "conversion_factor" IS NOT NULL AND "conversion_factor" > 0)
        OR ("conversion_mode" = 'VARIABLE' AND "conversion_factor" IS NULL)
    )
);

-- CreateTable
CREATE TABLE "supplier_product_mappings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "product_presentation_id" UUID NOT NULL,
    "supplier_code" VARCHAR(120) NOT NULL,
    "normalized_supplier_code" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "supplier_product_mappings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "supplier_product_mappings_code_not_empty_check" CHECK (length("normalized_supplier_code") > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "partners_id_organization_id_key" ON "partners"("id", "organization_id");
CREATE UNIQUE INDEX "partners_organization_id_tax_id_key" ON "partners"("organization_id", "tax_id");
CREATE INDEX "partners_organization_id_legal_name_idx" ON "partners"("organization_id", "legal_name");

CREATE UNIQUE INDEX "units_of_measure_id_organization_id_key" ON "units_of_measure"("id", "organization_id");
CREATE UNIQUE INDEX "units_of_measure_organization_id_code_key" ON "units_of_measure"("organization_id", "code");

CREATE UNIQUE INDEX "products_id_organization_id_key" ON "products"("id", "organization_id");
CREATE UNIQUE INDEX "products_organization_id_sku_key" ON "products"("organization_id", "sku");
CREATE INDEX "products_organization_id_short_description_idx" ON "products"("organization_id", "short_description");

CREATE UNIQUE INDEX "product_presentations_id_organization_id_key" ON "product_presentations"("id", "organization_id");
CREATE UNIQUE INDEX "product_presentations_organization_id_product_id_code_key" ON "product_presentations"("organization_id", "product_id", "code");
CREATE INDEX "product_presentations_organization_id_unit_of_measure_id_idx" ON "product_presentations"("organization_id", "unit_of_measure_id");

CREATE UNIQUE INDEX "supplier_product_mappings_organization_id_supplier_id_normalized_supplier_code_key" ON "supplier_product_mappings"("organization_id", "supplier_id", "normalized_supplier_code");
CREATE INDEX "supplier_product_mappings_organization_id_product_presentation_id_idx" ON "supplier_product_mappings"("organization_id", "product_presentation_id");

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "units_of_measure" ADD CONSTRAINT "units_of_measure_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_base_unit_id_organization_id_fkey" FOREIGN KEY ("base_unit_id", "organization_id") REFERENCES "units_of_measure"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_presentations" ADD CONSTRAINT "product_presentations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_presentations" ADD CONSTRAINT "product_presentations_product_id_organization_id_fkey" FOREIGN KEY ("product_id", "organization_id") REFERENCES "products"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_presentations" ADD CONSTRAINT "product_presentations_unit_of_measure_id_organization_id_fkey" FOREIGN KEY ("unit_of_measure_id", "organization_id") REFERENCES "units_of_measure"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supplier_product_mappings" ADD CONSTRAINT "supplier_product_mappings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_product_mappings" ADD CONSTRAINT "supplier_product_mappings_supplier_id_organization_id_fkey" FOREIGN KEY ("supplier_id", "organization_id") REFERENCES "partners"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_product_mappings" ADD CONSTRAINT "supplier_product_mappings_product_presentation_id_organization_id_fkey" FOREIGN KEY ("product_presentation_id", "organization_id") REFERENCES "product_presentations"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
