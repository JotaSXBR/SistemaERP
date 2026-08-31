import { createApiClient } from "@sistema-erp/contracts";

export const apiClient = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || window.location.origin,
});
