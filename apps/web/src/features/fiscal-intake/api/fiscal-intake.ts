import {
  catalogControllerCreateProduct,
  catalogControllerCreateSupplierMapping,
  catalogControllerFindProductById,
  catalogControllerListProducts,
  fiscalIntakeControllerFindById,
  fiscalIntakeControllerIngest,
  fiscalIntakeControllerList,
  fiscalIntakeControllerResolve,
  partnersControllerCreate,
  partnersControllerFindById,
  partnersControllerUpdate,
  type CreateProductRequestDto,
  type NfeInboxListResponseDto,
  type NfePersistentIntakeDto,
  type PartnerDto,
  type ProductDetailDto,
  type ProductListResponseDto,
} from "@sistema-erp/contracts";

import { apiClient } from "../../../shared/api/client.js";

export class FiscalIntakeRequestError extends Error {
  constructor(readonly status: number | undefined) {
    super("Não foi possível concluir a operação fiscal");
    this.name = "FiscalIntakeRequestError";
  }
}

function resultOrThrow<T>(data: T | undefined, status: number | undefined): T {
  if (!data) throw new FiscalIntakeRequestError(status);
  return data;
}

export async function listFiscalDocuments(): Promise<NfeInboxListResponseDto> {
  const { data, response } = await fiscalIntakeControllerList({
    client: apiClient,
    query: { limit: 50, offset: 0 },
  });
  return resultOrThrow(data, response?.status);
}

export async function getFiscalDocument(documentId: string): Promise<NfePersistentIntakeDto> {
  const { data, response } = await fiscalIntakeControllerFindById({
    client: apiClient,
    path: { documentId },
  });
  return resultOrThrow(data, response?.status);
}

export async function ingestNfe(file: File, idempotencyKey: string) {
  const { data, response } = await fiscalIntakeControllerIngest({
    body: file,
    client: apiClient,
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return resultOrThrow(data, response?.status);
}

export async function resolveFiscalDocument(documentId: string): Promise<NfePersistentIntakeDto> {
  const { data, response } = await fiscalIntakeControllerResolve({
    client: apiClient,
    path: { documentId },
  });
  return resultOrThrow(data, response?.status);
}

export async function createSupplier(input: {
  legalName: string;
  taxId: string;
}): Promise<PartnerDto> {
  const { data, response } = await partnersControllerCreate({
    body: {
      legalName: input.legalName,
      roles: ["SUPPLIER"],
      taxId: input.taxId,
      type: "ORGANIZATION",
    },
    client: apiClient,
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
  return resultOrThrow(data, response?.status).partner;
}

export async function enableSupplier(partnerId: string): Promise<PartnerDto> {
  const current = await partnersControllerFindById({ client: apiClient, path: { id: partnerId } });
  const partner = resultOrThrow(current.data, current.response?.status).partner;
  const { data, response } = await partnersControllerUpdate({
    body: { active: true, roles: [...new Set([...partner.roles, "SUPPLIER" as const])] },
    client: apiClient,
    headers: { "Idempotency-Key": crypto.randomUUID() },
    path: { id: partnerId },
  });
  return resultOrThrow(data, response?.status).partner;
}

export async function listProducts(search?: string): Promise<ProductListResponseDto> {
  const { data, response } = await catalogControllerListProducts({
    client: apiClient,
    query: { active: true, limit: 100, offset: 0, ...(search ? { search } : {}) },
  });
  return resultOrThrow(data, response?.status);
}

export async function getProduct(productId: string): Promise<ProductDetailDto> {
  const { data, response } = await catalogControllerFindProductById({
    client: apiClient,
    path: { id: productId },
  });
  return resultOrThrow(data, response?.status).product;
}

export async function createProduct(input: CreateProductRequestDto): Promise<ProductDetailDto> {
  const { data, response } = await catalogControllerCreateProduct({
    body: input,
    client: apiClient,
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
  const created = resultOrThrow(data, response?.status).product;
  return {
    active: created.active,
    // Facetas e geometria vem da propria resposta desde que o POST passou a aceita-las; a
    // ingestao ainda nao as envia, mas o formato ja e o mesmo do detalhe do produto.
    attributes: created.attributes,
    baseUnit: created.baseUnit,
    geometry: created.geometry,
    id: created.id,
    presentations: [created.basePresentation],
    shortDescription: created.shortDescription,
    sku: created.sku,
    ...(created.technicalDescription ? { technicalDescription: created.technicalDescription } : {}),
  };
}

export async function createSupplierMapping(input: {
  productPresentationId: string;
  supplierCode: string;
  supplierId: string;
}): Promise<void> {
  const { data, response } = await catalogControllerCreateSupplierMapping({
    body: input,
    client: apiClient,
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
  resultOrThrow(data, response?.status);
}
