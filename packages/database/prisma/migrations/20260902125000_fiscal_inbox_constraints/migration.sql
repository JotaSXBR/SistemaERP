ALTER TABLE "inbound_fiscal_documents"
ADD CONSTRAINT "inbound_fiscal_documents_access_key_check"
CHECK ("access_key" ~ '^[0-9]{44}$'),
ADD CONSTRAINT "inbound_fiscal_documents_tax_ids_check"
CHECK (
    "supplier_tax_id" ~ '^[A-Z0-9]{11,32}$'
    AND "recipient_tax_id" ~ '^[A-Z0-9]{11,32}$'
),
ADD CONSTRAINT "inbound_fiscal_documents_required_text_check"
CHECK (
    length("schema_version") > 0
    AND length("document_number") > 0
    AND length("series") > 0
    AND length("supplier_name") > 0
    AND length("nature_of_operation") > 0
),
ADD CONSTRAINT "inbound_fiscal_documents_total_check"
CHECK ("document_total" >= 0);

ALTER TABLE "inbound_fiscal_document_items"
ADD CONSTRAINT "inbound_fiscal_document_items_codes_check"
CHECK (
    "ncm" ~ '^[0-9]{8}$'
    AND ("cest" IS NULL OR "cest" ~ '^[0-9]{7}$')
    AND "cfop" ~ '^[0-9]{4}$'
),
ADD CONSTRAINT "inbound_fiscal_document_items_required_text_check"
CHECK (
    length("item_number") > 0
    AND length("supplier_code") > 0
    AND length("description") > 0
    AND length("commercial_unit") > 0
    AND length("taxable_unit") > 0
),
ADD CONSTRAINT "inbound_fiscal_document_items_values_check"
CHECK (
    "commercial_quantity" > 0
    AND "commercial_unit_value" >= 0
    AND "taxable_quantity" > 0
    AND "taxable_unit_value" >= 0
    AND "total_value" >= 0
);

ALTER TABLE "fiscal_document_ingestions"
ADD CONSTRAINT "fiscal_document_ingestions_hash_check"
CHECK ("hash_sha256" ~ '^[0-9a-f]{64}$'),
ADD CONSTRAINT "fiscal_document_ingestions_size_check"
CHECK ("byte_size" BETWEEN 1 AND 5242880),
ADD CONSTRAINT "fiscal_document_ingestions_content_type_check"
CHECK ("content_type" IN ('application/xml', 'text/xml')),
ADD CONSTRAINT "fiscal_document_ingestions_required_text_check"
CHECK (
    length("object_key") > 0
    AND length("request_id") > 0
    AND length("correlation_id") > 0
);
