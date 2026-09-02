import { organizationsControllerGetCurrent, type OrganizationDto } from "@sistema-erp/contracts";

import { apiClient } from "../../../shared/api/client.js";

export class OrganizationRequestError extends Error {
  constructor(readonly status: number | undefined) {
    super("Não foi possível consultar a empresa atual");
    this.name = "OrganizationRequestError";
  }
}

export async function getCurrentOrganization(): Promise<OrganizationDto> {
  const { data, response } = await organizationsControllerGetCurrent({ client: apiClient });

  if (!data) {
    throw new OrganizationRequestError(response?.status);
  }

  return data;
}
