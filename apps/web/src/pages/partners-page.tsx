import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { PartnerDto } from "@sistema-erp/contracts";

import { useSession } from "../features/authentication/session-context.js";
import { listPartners, type PartnerRoleFilter } from "../features/registry/api/registry.js";
import { PartnerCreateForm } from "../features/registry/components/partner-create-form.js";
import { PartnerEditForm } from "../features/registry/components/partner-edit-form.js";
import { RegistryListShell } from "../features/registry/components/registry-list-shell.js";
import { formatTaxId } from "../features/registry/format-tax-id.js";
import { SideDrawer } from "../shared/components/side-drawer.js";
import { useDebouncedValue } from "../shared/hooks/use-debounced-value.js";

const SEARCH_DEBOUNCE_MS = 300;

const ROLE_LABELS: Record<PartnerRoleFilter, string> = {
  CARRIER: "Transportadora",
  CUSTOMER: "Cliente",
  SUPPLIER: "Fornecedor",
};

const ROLE_FILTERS: Array<{ label: string; value: PartnerRoleFilter | "" }> = [
  { label: "Todos os papéis", value: "" },
  { label: ROLE_LABELS.SUPPLIER, value: "SUPPLIER" },
  { label: ROLE_LABELS.CUSTOMER, value: "CUSTOMER" },
  { label: ROLE_LABELS.CARRIER, value: "CARRIER" },
];

const TYPE_LABELS: Record<string, string> = {
  ORGANIZATION: "Pessoa jurídica",
  PERSON: "Pessoa física",
};

export function PartnersPage() {
  const { identity } = useSession();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PartnerDto>();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<PartnerRoleFilter | "">("");
  const [offset, setOffset] = useState(0);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  // Um filtro novo invalida a página em que o usuário estava; voltar ao início evita uma lista
  // vazia por deslocamento maior que o novo total.
  useEffect(() => setOffset(0), [debouncedSearch, role]);

  const partners = useQuery({
    placeholderData: keepPreviousData,
    queryFn: () =>
      listPartners({
        offset,
        ...(role ? { role } : {}),
        ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      }),
    queryKey: ["partners", "list", { offset, role, search: debouncedSearch.trim() }],
  });

  const items = partners.data?.items ?? [];
  const hasFilter = debouncedSearch.trim().length > 0 || role !== "";
  const canWrite = identity?.role === "OWNER" || identity?.role === "ADMIN";

  async function refreshAfterSave(): Promise<void> {
    setEditing(undefined);
    await queryClient.invalidateQueries({ queryKey: ["partners", "list"] });
  }

  async function refreshAfterCreate(): Promise<void> {
    setCreating(false);
    await queryClient.invalidateQueries({ queryKey: ["partners", "list"] });
  }

  return (
    <>
      <RegistryListShell
        actions={
          canWrite ? (
            <button
              className="min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700"
              onClick={() => setCreating(true)}
              type="button"
            >
              Novo parceiro
            </button>
          ) : undefined
        }
        description="Fornecedores, clientes e transportadoras desta empresa. A busca cobre razão social, nome fantasia e identificador fiscal."
        emptyMessage={
          hasFilter
            ? "Nenhum parceiro corresponde ao filtro aplicado."
            : "Nenhum parceiro cadastrado nesta empresa."
        }
        eyebrow="Cadastros"
        filters={
          <select
            aria-label="Filtrar por papel"
            className="min-h-11 rounded-xl border border-line bg-panel px-3 text-sm text-ink-950 outline-none focus:border-brand-600"
            onChange={(event) => setRole(event.currentTarget.value as PartnerRoleFilter | "")}
            value={role}
          >
            {ROLE_FILTERS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        }
        isEmpty={items.length === 0}
        isError={partners.isError}
        isPending={partners.isPending}
        offset={offset}
        onOffsetChange={setOffset}
        onRetry={() => void partners.refetch()}
        onSearchChange={setSearch}
        searchLabel="Buscar parceiro"
        searchPlaceholder="Razão social, nome fantasia ou CPF/CNPJ"
        searchValue={search}
        title="Parceiros"
        total={partners.data?.total ?? 0}
      >
        <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
          <thead className="text-xs tracking-[0.08em] text-ink-500 uppercase">
            <tr className="border-b border-line">
              <th className="px-6 py-4 font-semibold" scope="col">
                Razão social
              </th>
              <th className="px-6 py-4 font-semibold" scope="col">
                CPF/CNPJ
              </th>
              <th className="px-6 py-4 font-semibold" scope="col">
                Tipo
              </th>
              <th className="px-6 py-4 font-semibold" scope="col">
                Papéis
              </th>
              <th className="px-6 py-4 font-semibold" scope="col">
                Situação
              </th>
              <th className="px-6 py-4 font-semibold" scope="col">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((partner) => (
              <tr className="border-b border-line last:border-b-0" key={partner.id}>
                <td className="px-6 py-4">
                  <p className="font-medium text-ink-950">{partner.legalName}</p>
                  {partner.tradeName ? (
                    <p className="mt-1 text-xs text-ink-500">{partner.tradeName}</p>
                  ) : null}
                </td>
                <td className="px-6 py-4 tabular-nums text-ink-700">
                  {formatTaxId(partner.taxId)}
                </td>
                <td className="px-6 py-4 text-ink-700">
                  {TYPE_LABELS[partner.type] ?? partner.type}
                </td>
                <td className="px-6 py-4 text-ink-700">
                  {partner.roles.map((value) => ROLE_LABELS[value] ?? value).join(", ")}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      partner.active ? "bg-brand-50 text-brand-700" : "bg-canvas text-ink-500"
                    }`}
                  >
                    {partner.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {canWrite ? (
                    <button
                      aria-label={`Editar ${partner.legalName}`}
                      className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold text-ink-950 transition hover:bg-canvas"
                      onClick={() => setEditing(partner)}
                      type="button"
                    >
                      Editar
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </RegistryListShell>

      {creating ? (
        <SideDrawer onClose={() => setCreating(false)} title="Novo parceiro">
          <PartnerCreateForm onCreated={refreshAfterCreate} />
        </SideDrawer>
      ) : null}

      {editing ? (
        <SideDrawer onClose={() => setEditing(undefined)} title="Editar parceiro">
          <PartnerEditForm onSaved={refreshAfterSave} partner={editing} />
        </SideDrawer>
      ) : null}
    </>
  );
}
