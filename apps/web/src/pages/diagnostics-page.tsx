import { useQuery } from "@tanstack/react-query";

import { getLiveness, getReadiness } from "../features/diagnostics/api/system-health.js";
import { StatusCard } from "../features/diagnostics/components/status-card.js";

function PulseIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M3 12h4l2.2-6 4.1 12 2.2-6H21"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <ellipse cx="12" cy="5" rx="8" ry="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

export function DiagnosticsPage() {
  const liveness = useQuery({
    queryFn: getLiveness,
    queryKey: ["diagnostics", "liveness"],
    staleTime: 30_000,
  });
  const readiness = useQuery({
    queryFn: getReadiness,
    queryKey: ["diagnostics", "readiness"],
    staleTime: 30_000,
  });
  const isRefreshing = liveness.isFetching || readiness.isFetching;

  async function refresh(): Promise<void> {
    await Promise.all([liveness.refetch(), readiness.refetch()]);
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-col gap-5 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-brand-700 uppercase">
            Ambiente local
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-ink-950 sm:text-4xl">
            Diagnóstico do sistema
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-700 sm:text-base">
            Acompanhe a disponibilidade da aplicação e das dependências essenciais antes de iniciar
            uma operação.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
          disabled={isRefreshing}
          onClick={() => void refresh()}
          type="button"
        >
          <svg
            aria-hidden="true"
            className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              d="M20 6v5h-5M4 18v-5h5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
            <path
              d="M18.5 9A7 7 0 0 0 6 6.5L4 9m2 6a7 7 0 0 0 12.5 2.5L20 15"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
            />
          </svg>
          {isRefreshing ? "Verificando" : "Verificar novamente"}
        </button>
      </div>

      <section aria-label="Estado dos serviços" className="mt-8 grid gap-5 lg:grid-cols-2">
        <StatusCard
          description="Confirma que o processo HTTP está ativo e pronto para receber requisições."
          error={liveness.error}
          icon={<PulseIcon />}
          isFetching={liveness.isFetching}
          isPending={liveness.isPending}
          requestId={liveness.data?.requestId}
          title="API"
        />
        <StatusCard
          description="Valida a conexão transacional e a prontidão do PostgreSQL."
          error={readiness.error}
          icon={<DatabaseIcon />}
          isFetching={readiness.isFetching}
          isPending={readiness.isPending}
          requestId={readiness.data?.requestId}
          title="Banco de dados"
        />
      </section>

      <aside className="mt-8 rounded-2xl border border-brand-100 bg-brand-50/70 px-5 py-4 text-sm leading-6 text-brand-700">
        Esta tela consulta a API pelo cliente gerado do contrato OpenAPI. Nenhuma URL de endpoint é
        construída pelos componentes visuais.
      </aside>
    </div>
  );
}
