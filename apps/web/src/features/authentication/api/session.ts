import {
  authControllerCreateSession,
  authControllerCurrentSession,
  authControllerRevokeSession,
  type CreateSessionRequestDto,
  type SessionIdentityDto,
} from "@sistema-erp/contracts";

import { apiClient } from "../../../shared/api/client.js";
import {
  clearSessionToken,
  readSessionToken,
  writeSessionToken,
} from "../../../shared/api/session-token.js";

export type SessionIdentity = SessionIdentityDto;
export type SignInInput = CreateSessionRequestDto;

export type SignInFailureReason = "INVALID_CREDENTIALS" | "RATE_LIMITED" | "UNAVAILABLE";

export class SignInError extends Error {
  constructor(readonly reason: SignInFailureReason) {
    super("Não foi possível iniciar a sessão");
    this.name = "SignInError";
  }
}

function failureReasonFor(status: number | undefined): SignInFailureReason {
  if (status === 401 || status === 400) {
    return "INVALID_CREDENTIALS";
  }

  return status === 429 ? "RATE_LIMITED" : "UNAVAILABLE";
}

export async function signIn(input: SignInInput): Promise<SessionIdentity> {
  const { data, response } = await authControllerCreateSession({
    body: input,
    client: apiClient,
  });

  if (!data) {
    throw new SignInError(failureReasonFor(response?.status));
  }

  writeSessionToken(data.token);

  return { organizationId: data.organizationId, role: data.role, userId: data.userId };
}

/**
 * Retorna `null` quando não há sessão utilizável. O servidor continua sendo a autoridade: um token
 * presente no navegador só vira identidade depois de ser validado.
 */
export async function readCurrentSession(): Promise<SessionIdentity | null> {
  if (readSessionToken() === undefined) {
    return null;
  }

  const { data } = await authControllerCurrentSession({ client: apiClient });

  return data ?? null;
}

export async function signOut(): Promise<void> {
  try {
    await authControllerRevokeSession({ client: apiClient });
  } finally {
    clearSessionToken();
  }
}
