import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-line bg-panel p-8 text-center shadow-panel">
      <p className="text-sm font-semibold text-brand-700">Erro 404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Página não encontrada</h1>
      <p className="mt-3 text-ink-700">O endereço informado não faz parte desta aplicação.</p>
      <Link
        className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-ink-950 px-5 text-sm font-semibold text-white hover:bg-brand-700"
        to="/diagnostics"
      >
        Voltar ao diagnóstico
      </Link>
    </div>
  );
}
