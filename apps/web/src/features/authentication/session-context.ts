import { createContext, useContext } from "react";

import type { SessionIdentity, SignInInput } from "./api/session.js";

export type SessionStatus = "anonymous" | "authenticated" | "loading";

export type SessionContextValue = {
  identity: SessionIdentity | null;
  signIn: (input: SignInInput) => Promise<SessionIdentity>;
  signOut: () => Promise<void>;
  status: SessionStatus;
};

export const SESSION_QUERY_KEY = ["session"] as const;

export const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);

  if (!value) {
    throw new Error("useSession requer um SessionProvider acima na árvore de componentes");
  }

  return value;
}
