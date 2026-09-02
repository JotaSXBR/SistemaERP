import { createApiClient } from "@sistema-erp/contracts";

import { clearSessionToken, readSessionToken } from "./session-token.js";

export const apiClient = createApiClient({
  auth: () => readSessionToken(),
  baseUrl: import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || window.location.origin,
});

/**
 * Uma sessão expirada ou revogada pelo servidor deve deixar de valer também no cliente. O token é
 * descartado aqui para que a próxima navegação caia no fluxo de login em vez de repetir requisições
 * que já não são aceitas.
 */
apiClient.interceptors.response.use((response) => {
  if (response.status === 401 && readSessionToken() !== undefined) {
    clearSessionToken();
  }

  return response;
});
