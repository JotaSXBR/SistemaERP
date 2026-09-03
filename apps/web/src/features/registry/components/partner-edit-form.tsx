import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import type { PartnerDto } from "@sistema-erp/contracts";

import { updatePartner, type PartnerRoleFilter } from "../api/registry.js";
import { formatTaxId } from "../format-tax-id.js";

const ROLE_OPTIONS: Array<{ label: string; value: PartnerRoleFilter }> = [
  { label: "Fornecedor", value: "SUPPLIER" },
  { label: "Cliente", value: "CUSTOMER" },
  { label: "Transportadora", value: "CARRIER" },
];

export function PartnerEditForm({
  onSaved,
  partner,
}: {
  onSaved: () => Promise<void>;
  partner: PartnerDto;
}) {
  const [active, setActive] = useState(partner.active);
  const [roles, setRoles] = useState<PartnerRoleFilter[]>(partner.roles);
  const mutation = useMutation({
    mutationFn: async () => {
      await updatePartner(partner.id, { active, roles });
      await onSaved();
    },
  });

  // A API exige ao menos um papel; bloquear no cliente evita uma ida ao servidor para receber 400.
  const rolesEmpty = roles.length === 0;
  const unchanged =
    active === partner.active &&
    [...roles].sort().join(",") === [...partner.roles].sort().join(",");

  function toggleRole(role: PartnerRoleFilter) {
    setRoles((current) =>
      current.includes(role) ? current.filter((value) => value !== role) : [...current, role],
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="rounded-xl bg-canvas p-4">
        <p className="text-xs font-semibold text-ink-500 uppercase">Identificação</p>
        <p className="mt-2 text-sm font-medium text-ink-950">{partner.legalName}</p>
        <p className="mt-1 font-mono text-sm text-ink-700">{formatTaxId(partner.taxId)}</p>
        <p className="mt-3 text-xs leading-5 text-ink-500">
          Razão social, identificador fiscal e tipo não são editáveis aqui; o identificador fiscal é
          a chave do parceiro dentro da empresa.
        </p>
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-ink-950">Papéis</legend>
        <p className="mt-1 text-xs text-ink-500">Ao menos um papel é obrigatório.</p>
        {ROLE_OPTIONS.map((option) => (
          <label
            className="mt-3 flex min-h-11 items-center gap-3 text-sm text-ink-950"
            key={option.value}
          >
            <input
              checked={roles.includes(option.value)}
              className="size-4"
              disabled={mutation.isPending}
              onChange={() => toggleRole(option.value)}
              type="checkbox"
            />
            {option.label}
          </label>
        ))}
        {rolesEmpty ? (
          <p className="mt-2 text-sm text-alert-600" role="alert">
            Selecione ao menos um papel.
          </p>
        ) : null}
      </fieldset>

      <label className="mt-6 flex min-h-11 items-center gap-3 text-sm text-ink-950">
        <input
          checked={active}
          className="size-4"
          disabled={mutation.isPending}
          onChange={(event) => setActive(event.currentTarget.checked)}
          type="checkbox"
        />
        Parceiro ativo
      </label>

      {mutation.error ? (
        <p className="mt-5 text-sm text-alert-600" role="alert">
          Não foi possível salvar o parceiro.
        </p>
      ) : null}

      <button
        className="mt-7 min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        disabled={mutation.isPending || rolesEmpty || unchanged}
        type="submit"
      >
        {mutation.isPending ? "Salvando…" : "Salvar parceiro"}
      </button>
    </form>
  );
}
