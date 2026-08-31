import {
  healthControllerLiveness,
  healthControllerReadiness,
  type HealthResponse,
  type ReadinessResponse,
} from "@sistema-erp/contracts";

import { apiClient } from "../../../shared/api/client.js";

export type DiagnosticResult<T> = {
  data: T;
  requestId: string | undefined;
};

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly requestId?: string,
  ) {
    super("Não foi possível consultar a API");
    this.name = "ApiRequestError";
  }
}

function requireData<T>(data: T | undefined, response: Response | undefined): DiagnosticResult<T> {
  const requestId = response?.headers.get("x-request-id") ?? undefined;

  if (data === undefined || response === undefined) {
    throw new ApiRequestError(response?.status ?? 0, requestId);
  }

  return { data, requestId };
}

export async function getLiveness(): Promise<DiagnosticResult<HealthResponse>> {
  const { data, response } = await healthControllerLiveness({ client: apiClient });

  return requireData(data, response);
}

export async function getReadiness(): Promise<DiagnosticResult<ReadinessResponse>> {
  const { data, response } = await healthControllerReadiness({ client: apiClient });

  return requireData(data, response);
}
