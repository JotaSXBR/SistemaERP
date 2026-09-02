import { Navigate, useLocation, useNavigate } from "react-router";

import { LoginForm } from "../features/authentication/components/login-form.js";
import { useSession } from "../features/authentication/session-context.js";

type LocationState = { from?: { pathname?: string } };

export function LoginPage() {
  const { status } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const intendedPath = (location.state as LocationState | null)?.from?.pathname ?? "/organization";

  if (status === "authenticated") {
    return <Navigate replace to={intendedPath} />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-line bg-panel p-8 shadow-panel">
        <div className="flex size-10 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold tracking-tight text-white">
          SE
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink-950">
          Entrar no Sistema ERP
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-700">
          A sessão vale para uma empresa por vez. Para trabalhar em outra, entre novamente com o
          identificador correspondente.
        </p>

        <LoginForm onAuthenticated={() => void navigate(intendedPath, { replace: true })} />
      </section>
    </main>
  );
}
