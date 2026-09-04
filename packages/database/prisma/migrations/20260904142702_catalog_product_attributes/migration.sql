-- CreateTable
CREATE TABLE "product_attribute_definitions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_attribute_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_attribute_options" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_attribute_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_attributes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "option_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_attribute_definitions_id_organization_id_key" ON "product_attribute_definitions"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_attribute_definitions_organization_id_code_key" ON "product_attribute_definitions"("organization_id", "code");

-- CreateIndex
CREATE INDEX "product_attribute_options_organization_id_definition_id_idx" ON "product_attribute_options"("organization_id", "definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_attribute_options_id_organization_id_key" ON "product_attribute_options"("id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_attribute_options_id_definition_id_organization_id_key" ON "product_attribute_options"("id", "definition_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_attribute_options_organization_id_definition_id_cod_key" ON "product_attribute_options"("organization_id", "definition_id", "code");

-- CreateIndex
CREATE INDEX "product_attributes_organization_id_option_id_idx" ON "product_attributes"("organization_id", "option_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_attributes_product_id_definition_id_key" ON "product_attributes"("product_id", "definition_id");

-- AddForeignKey
ALTER TABLE "product_attribute_definitions" ADD CONSTRAINT "product_attribute_definitions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_options" ADD CONSTRAINT "product_attribute_options_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_options" ADD CONSTRAINT "product_attribute_options_definition_id_organization_id_fkey" FOREIGN KEY ("definition_id", "organization_id") REFERENCES "product_attribute_definitions"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_product_id_organization_id_fkey" FOREIGN KEY ("product_id", "organization_id") REFERENCES "products"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_definition_id_organization_id_fkey" FOREIGN KEY ("definition_id", "organization_id") REFERENCES "product_attribute_definitions"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_option_id_definition_id_organization_id_fkey" FOREIGN KEY ("option_id", "definition_id", "organization_id") REFERENCES "product_attribute_options"("id", "definition_id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
