import {
  catalogControllerListProducts,
  partnersControllerList,
  type PartnerListResponseDto,
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
