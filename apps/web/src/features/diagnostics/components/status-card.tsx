import type { ReactNode } from "react";

type StatusCardProps = {
  description: string;
  error: Error | null;
  icon: ReactNode;
  isFetching: boolean;
  isPending: boolean;
  requestId: string | undefined;
  title: string;
};

export function StatusCard({
  description,
  error,
  icon,
  isFetching,
  isPending,
  requestId,
  title,
}: StatusCardProps) {
  const isHealthy = !isPending && error === null;

  return (
    <article className="rounded-3xl border border-line bg-panel p-6 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          {icon}
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
            isPending
              ? "bg-slate-100 text-ink-500"
              : isHealthy
                ? "bg-brand-50 text-brand-700"
                : "bg-alert-50 text-alert-600"
          }`}
        >
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full ${
              isPending ? "bg-ink-500" : isHealthy ? "bg-brand-500" : "bg-alert-600"
            }`}
          />
          {isPending ? "Verificando" : isHealthy ? "Operacional" : "Indisponível"}
        </span>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold tracking-tight text-ink-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-ink-700">{description}</p>
      </div>

      <div className="mt-6 border-t border-line pt-4 text-xs text-ink-500">
        {isPending ? (
          <p role="status">Aguardando resposta da API…</p>
        ) : error ? (
          <p role="alert">A verificação falhou. Tente novamente.</p>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <span>{isFetching ? "Atualizando…" : "Última verificação concluída"}</span>
            <code className="max-w-44 truncate rounded-md bg-canvas px-2 py-1" title={requestId}>
              {requestId ?? "sem requestId"}
            </code>
          </div>
        )}
      </div>
    </article>
  );
}
