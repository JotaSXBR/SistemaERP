import type { ReactNode } from "react";

import { REGISTRY_PAGE_SIZE } from "../api/registry.js";

type RegistryListShellProps = {
  children: ReactNode;
  description: string;
  emptyMessage: string;
  eyebrow: string;
  filters?: ReactNode;
  isEmpty: boolean;
  isError: boolean;
  isPending: boolean;
  offset: number;
  onOffsetChange: (offset: number) => void;
  onRetry: () => void;
  onSearchChange: (search: string) => void;
  searchLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  title: string;
  total: number;
};

function PageSummary({ offset, total }: { offset: number; total: number }) {
  if (total === 0) return <span>Nenhum registro</span>;

  const first = offset + 1;
  const last = Math.min(offset + REGISTRY_PAGE_SIZE, total);
  return (
    <span>
      {first}–{last} de {total}
    </span>
  );
}

export function RegistryListShell({
  children,
  description,
  emptyMessage,
  eyebrow,
  filters,
  isEmpty,
  isError,
  isPending,
  offset,
  onOffsetChange,
  onRetry,
  onSearchChange,
  searchLabel,
  searchPlaceholder,
  searchValue,
  title,
  total,
}: RegistryListShellProps) {
  const searchInputId = `${eyebrow.toLowerCase().replace(/\s+/g, "-")}-search`;
  const hasPrevious = offset > 0;
  const hasNext = offset + REGISTRY_PAGE_SIZE < total;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-col gap-6 border-b border-line pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-brand-700 uppercase">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-ink-950">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-700">{description}</p>
        </div>

        <div className="w-full max-w-md">
          <label className="block text-sm font-semibold text-ink-950" htmlFor={searchInputId}>
            {searchLabel}
          </label>
          <input
            autoComplete="off"
            className="mt-3 block min-h-11 w-full rounded-xl border border-line bg-panel px-4 text-sm text-ink-950 outline-none focus:border-brand-600"
            id={searchInputId}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            placeholder={searchPlaceholder}
            type="search"
            value={searchValue}
          />
          {filters ? <div className="mt-3 flex flex-wrap gap-2">{filters}</div> : null}
        </div>
      </div>

      <section
        aria-busy={isPending}
        aria-label={title}
        className="mt-8 rounded-3xl border border-line bg-panel shadow-panel"
      >
        {isPending ? (
          <p className="p-6 text-sm text-ink-500" role="status">
            Carregando registros…
          </p>
        ) : isError ? (
          <div className="p-6" role="alert">
            <p className="text-sm text-alert-600">Não foi possível carregar os registros.</p>
            <button
              className="mt-4 min-h-11 rounded-xl bg-ink-950 px-5 text-sm font-semibold text-white transition hover:bg-brand-700"
              onClick={onRetry}
              type="button"
            >
              Tentar novamente
            </button>
          </div>
        ) : isEmpty ? (
          <p className="p-6 text-sm text-ink-500">{emptyMessage}</p>
        ) : (
          <div className="overflow-x-auto">{children}</div>
        )}
      </section>

      {isPending || isError || isEmpty ? null : (
        <nav
          aria-label="Paginação"
          className="mt-4 flex items-center justify-between text-sm text-ink-500"
        >
          <PageSummary offset={offset} total={total} />
          <div className="flex gap-2">
            <button
              className="min-h-11 rounded-xl border border-line px-4 font-semibold text-ink-950 transition enabled:hover:bg-canvas disabled:opacity-40"
              disabled={!hasPrevious}
              onClick={() => onOffsetChange(Math.max(0, offset - REGISTRY_PAGE_SIZE))}
              type="button"
            >
              Anterior
            </button>
            <button
              className="min-h-11 rounded-xl border border-line px-4 font-semibold text-ink-950 transition enabled:hover:bg-canvas disabled:opacity-40"
              disabled={!hasNext}
              onClick={() => onOffsetChange(offset + REGISTRY_PAGE_SIZE)}
              type="button"
            >
              Próxima
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
