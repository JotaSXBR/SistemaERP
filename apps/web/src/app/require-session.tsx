import { Navigate, Outlet, useLocation } from "react-router";

import { useSession } from "../features/authentication/session-context.js";

export function RequireSession() {
  const { status } = useSession();
  const location = useLocation();

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <p className="text-sm text-ink-500" role="status">
          Validando a sessão…
        </p>
      </main>
    );
  }

  if (status === "anonymous") {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  return <Outlet />;
}
