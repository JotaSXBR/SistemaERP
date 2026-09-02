import { useQuery } from "@tanstack/react-query";

import { useSession } from "../features/authentication/session-context.js";
import { getCurrentOrganization } from "../features/organization/api/current-organization.js";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  MEMBER: "Membro",
  OWNER: "Proprietário",
};

function DefinitionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-line py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="text-sm font-medium text-ink-950">{value}</dd>
    </div>
  );
}

export function OrganizationPage() {
  const { identity } = useSession();
  const organization = useQuery({
    queryFn: getCurrentOrganization,
    queryKey: ["organization", "current"],
  });

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="border-b border-line pb-8">
        <p className="text-xs font-semibold tracking-[0.18em] text-brand-700 uppercase">Sessão</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-ink-950">
          Empresa atual
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-700">
          Todos os cadastros e documentos desta sessão pertencem exclusivamente a esta empresa.
        </p>
      </div>

      <section
        aria-label="Dados da empresa"
        className="mt-8 rounded-3xl border border-line bg-panel p-6 shadow-panel"
      >
        {organization.isPending ? (
          <p className="text-sm text-ink-500" role="status">
            Carregando dados da empresa…
          </p>
        ) : organization.error ? (
          <div role="alert">
            <p className="text-sm text-alert-600">Não foi possível carregar a empresa atual.</p>
            <button
              className="mt-4 min-h-11 rounded-xl bg-ink-950 px-5 text-sm font-semibold text-white transition hover:bg-brand-700"
              onClick={() => void organization.refetch()}
              type="button"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <dl>
            <DefinitionRow label="Nome" value={organization.data.name} />
            <DefinitionRow label="Identificador" value={organization.data.slug} />
            <DefinitionRow
              label="Seu papel"
              value={
                identity ? (ROLE_LABELS[identity.role] ?? identity.role) : "Sessão indisponível"
              }
            />
          </dl>
        )}
      </section>
    </div>
  );
}
