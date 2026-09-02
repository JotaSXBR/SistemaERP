import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, type ReactNode } from "react";

import { readSessionToken, subscribeToSessionToken } from "../../shared/api/session-token.js";
import {
  readCurrentSession,
  signIn as requestSignIn,
  signOut as requestSignOut,
  type SignInInput,
} from "./api/session.js";
import { SESSION_QUERY_KEY, SessionContext, type SessionContextValue } from "./session-context.js";

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const session = useQuery({
    queryFn: readCurrentSession,
    queryKey: SESSION_QUERY_KEY,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(
    () =>
      subscribeToSessionToken(() => {
        if (readSessionToken() === undefined) {
          queryClient.setQueryData(SESSION_QUERY_KEY, null);
        }
      }),
    [queryClient],
  );

  const value = useMemo<SessionContextValue>(() => {
    const identity = session.data ?? null;

    return {
      identity,
      signIn: async (input: SignInInput) => {
        const authenticated = await requestSignIn(input);

        queryClient.setQueryData(SESSION_QUERY_KEY, authenticated);

        return authenticated;
      },
      signOut: async () => {
        await requestSignOut();
        queryClient.setQueryData(SESSION_QUERY_KEY, null);
        // Nenhum dado de um tenant pode sobreviver à troca de sessão no mesmo navegador.
        queryClient.removeQueries({
          predicate: (query) => query.queryKey[0] !== SESSION_QUERY_KEY[0],
        });
      },
      status: session.isPending ? "loading" : identity ? "authenticated" : "anonymous",
    };
  }, [queryClient, session.data, session.isPending]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
