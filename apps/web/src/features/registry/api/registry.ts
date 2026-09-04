import {
  attributesControllerListDefinitions,
  catalogControllerCreateProduct,
  catalogControllerFindProductById,
  catalogControllerListProducts,
  catalogControllerUpdateProduct,
  partnersControllerCreate,
  partnersControllerList,
  partnersControllerUpdate,
  type CreatePartnerRequestDto,
  type CreateProductRequestDto,
  type PartnerDto,
  type PartnerListResponseDto,
  type ProductAttributeAssignmentDto,
  type ProductAttributeDefinitionDto,
  type ProductDetailDto,
  type ProductDto,
  type ProductGeometryUpdateDto,
  type ProductListResponseDto,
} from "@sistema-erp/contracts";

import { apiClient } from "../../../shared/api/client.js";

/** Tamanho de página das listagens de cadastro; alinhado ao `DEFAULT_PAGE_LIMIT` da API. */
export const REGISTRY_PAGE_SIZE = 20;

export type PartnerRoleFilter = "CARRIER" | "CUSTOMER" | "SUPPLIER";

export type RegistryQuery = {
  offset: number;
  search?: string;
};

export type PartnerQuery = RegistryQuery & {
  role?: PartnerRoleFilter;
};

export class RegistryRequestError extends Error {
  constructor(readonly status: number | undefined) {
    super("Não foi possível carregar o cadastro");
    this.name = "RegistryRequestError";
  }
}

function resultOrThrow<T>(data: T | undefined, status: number | undefined): T {
  if (!data) throw new RegistryRequestError(status);
  return data;
}

export async function listPartners(query: PartnerQuery): Promise<PartnerListResponseDto> {
  const { data, response } = await partnersControllerList({
    client: apiClient,
    query: {
      limit: REGISTRY_PAGE_SIZE,
      offset: query.offset,
      ...(query.role ? { role: query.role } : {}),
      ...(query.search ? { search: query.search } : {}),
    },
  });

  return resultOrThrow(data, response?.status);
}

export async function listCatalogProducts(query: RegistryQuery): Promise<ProductListResponseDto> {
  const { data, response } = await catalogControllerListProducts({
    client: apiClient,
    query: {
      limit: REGISTRY_PAGE_SIZE,
      offset: query.offset,
      ...(query.search ? { search: query.search } : {}),
    },
  });

  return resultOrThrow(data, response?.status);
}

export async function updatePartner(
  id: string,
  input: { active?: boolean; roles?: PartnerRoleFilter[] },
): Promise<PartnerDto> {
  const { data, response } = await partnersControllerUpdate({
    body: input,
    client: apiClient,
    headers: { "Idempotency-Key": crypto.randomUUID() },
    path: { id },
  });

  return resultOrThrow(data, response?.status).partner;
}

export async function createPartner(input: CreatePartnerRequestDto): Promise<PartnerDto> {
  const { data, response } = await partnersControllerCreate({
    body: input,
    client: apiClient,
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });

  return resultOrThrow(data, response?.status).partner;
}

export async function createProduct(input: CreateProductRequestDto): Promise<ProductDto> {
  const { data, response } = await catalogControllerCreateProduct({
    body: input,
    client: apiClient,
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });

  return resultOrThrow(data, response?.status).product;
}

export async function getProductDetail(id: string): Promise<ProductDetailDto> {
  const { data, response } = await catalogControllerFindProductById({
    client: apiClient,
    path: { id },
  });

  return resultOrThrow(data, response?.status).product;
}

/**
 * Só os eixos ativos entram no formulário: um eixo desativado continua válido nos produtos que já
 * o usam, mas não deve ser oferecido para novas classificações.
 */
export async function listAttributeDefinitions(): Promise<ProductAttributeDefinitionDto[]> {
  const { data, response } = await attributesControllerListDefinitions({
    client: apiClient,
    query: { active: true },
  });

  return resultOrThrow(data, response?.status).items;
}

export async function updateProduct(
  id: string,
  input: {
    active?: boolean;
    attributes?: ProductAttributeAssignmentDto[];
    geometry?: ProductGeometryUpdateDto;
    shortDescription?: string;
    technicalDescription?: string;
  },
): Promise<ProductDetailDto> {
  const { data, response } = await catalogControllerUpdateProduct({
    body: input,
    client: apiClient,
    headers: { "Idempotency-Key": crypto.randomUUID() },
    path: { id },
  });

  return resultOrThrow(data, response?.status).product;
}
