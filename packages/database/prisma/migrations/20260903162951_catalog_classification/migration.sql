-- AlterTable
ALTER TABLE "products" ADD COLUMN     "brand_id" UUID,
ADD COLUMN     "category_id" UUID;

-- CreateTable
CREATE TABLE "product_categories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "parent_id" UUID,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_brands" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_brands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_categories_organization_id_parent_id_idx" ON "product_categories"("organization_id", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_id_organization_id_key" ON "product_categories"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_organization_id_code_key" ON "product_categories"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "product_brands_id_organization_id_key" ON "product_brands"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_brands_organization_id_code_key" ON "product_brands"("organization_id", "code");

-- CreateIndex
CREATE INDEX "products_organization_id_category_id_idx" ON "products"("organization_id", "category_id");

-- CreateIndex
CREATE INDEX "products_organization_id_brand_id_idx" ON "products"("organization_id", "brand_id");

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_organization_id_fkey" FOREIGN KEY ("parent_id", "organization_id") REFERENCES "product_categories"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_brands" ADD CONSTRAINT "product_brands_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_organization_id_fkey" FOREIGN KEY ("category_id", "organization_id") REFERENCES "product_categories"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_organization_id_fkey" FOREIGN KEY ("brand_id", "organization_id") REFERENCES "product_brands"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "fiscal_document_ingestions_organization_id_idempotency_key_hash" RENAME TO "fiscal_document_ingestions_organization_id_idempotency_key__key";

-- Guardas de integridade da taxonomia. A profundidade e os ciclos mais longos sao validados no
-- servico; estas restricoes impedem os estados invalidos que o banco consegue barrar sozinho.
ALTER TABLE "product_categories"
ADD CONSTRAINT "product_categories_parent_not_self_check"
CHECK ("parent_id" IS NULL OR "parent_id" <> "id");

ALTER TABLE "product_categories"
ADD CONSTRAINT "product_categories_depth_check"
CHECK ("depth" >= 0 AND "depth" <= 5);

ALTER TABLE "product_categories"
ADD CONSTRAINT "product_categories_root_depth_check"
CHECK (("parent_id" IS NULL AND "depth" = 0) OR ("parent_id" IS NOT NULL AND "depth" > 0));

ALTER TABLE "product_categories"
ADD CONSTRAINT "product_categories_code_check"
CHECK ("code" ~ '^[A-Z0-9][-A-Z0-9._/]{0,39}$');

ALTER TABLE "product_brands"
ADD CONSTRAINT "product_brands_code_check"
CHECK ("code" ~ '^[A-Z0-9][-A-Z0-9._/]{0,39}$');
