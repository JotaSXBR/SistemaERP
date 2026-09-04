import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { createPartner, RegistryRequestError, type PartnerRoleFilter } from "../api/registry.js";

const CNPJ_DIGITS = 14;
const CPF_DIGITS = 11;
const CONFLICT_STATUS = 409;

const ROLE_OPTIONS: Array<{ label: string; value: PartnerRoleFilter }> = [
  { label: "Fornecedor", value: "SUPPLIER" },
  { label: "Cliente", value: "CUSTOMER" },
  { label: "Transportadora", value: "CARRIER" },
];

/**
 * A API persiste o identificador fiscal só com dígitos e aceita pontuação na entrada. Normalizar
 * aqui deixa a validação de comprimento previsível independente de como o usuário digitou.
 */
function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

const partnerSchema = z
  .object({
    legalName: z.string().trim().min(1, "Informe a razão social").max(160),
    roles: z
      .array(z.enum(["SUPPLIER", "CUSTOMER", "CARRIER"]))
      .min(1, "Selecione ao menos um papel"),
    taxId: z
      .string()
      .trim()
      .min(1, "Informe o CPF ou CNPJ")
      .refine(
        (value) => [CPF_DIGITS, CNPJ_DIGITS].includes(onlyDigits(value).length),
        "Informe 11 dígitos para CPF ou 14 para CNPJ",
      ),
    tradeName: z.string().trim().max(160).optional(),
    type: z.enum(["ORGANIZATION", "PERSON"]),
  })
  // Tipo e documento precisam concordar: a API trata o identificador fiscal como chave do parceiro
  // e não reclassifica o parceiro a partir dele.
  .refine(
    (values) =>
      onlyDigits(values.taxId).length ===
      (values.type === "ORGANIZATION" ? CNPJ_DIGITS : CPF_DIGITS),
    { message: "Pessoa jurídica exige CNPJ e pessoa física exige CPF", path: ["taxId"] },
  );

type PartnerForm = z.infer<typeof partnerSchema>;

const fieldClass =
  "mt-2 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink-950";

export function PartnerCreateForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const form = useForm<PartnerForm>({
    defaultValues: {
      legalName: "",
      roles: [],
      taxId: "",
      tradeName: "",
      type: "ORGANIZATION",
    },
    resolver: zodResolver(partnerSchema),
  });
  const mutation = useMutation({
    mutationFn: async (input: PartnerForm) => {
      const tradeName = input.tradeName?.trim();
      await createPartner({
        legalName: input.legalName.trim(),
        roles: input.roles,
        taxId: onlyDigits(input.taxId),
        type: input.type,
        ...(tradeName ? { tradeName } : {}),
      });
      await onCreated();
    },
  });
  const submit = form.handleSubmit((values) => mutation.mutate(values));

  const isConflict =
    mutation.error instanceof RegistryRequestError && mutation.error.status === CONFLICT_STATUS;

  return (
    <form onSubmit={(event) => void submit(event)}>
      <label className="block text-sm font-medium" htmlFor="partner-legal-name">
        Razão social
      </label>
      <input
        aria-describedby={form.formState.errors.legalName ? "partner-legal-name-error" : undefined}
        autoComplete="off"
        className={fieldClass}
        disabled={mutation.isPending}
        id="partner-legal-name"
        {...form.register("legalName")}
      />
      {form.formState.errors.legalName ? (
        <p className="mt-2 text-sm text-alert-600" id="partner-legal-name-error">
          {form.formState.errors.legalName.message}
        </p>
      ) : null}

      <label className="mt-5 block text-sm font-medium" htmlFor="partner-trade-name">
        Nome fantasia
      </label>
      <input
        autoComplete="off"
        className={fieldClass}
        disabled={mutation.isPending}
        id="partner-trade-name"
        {...form.register("tradeName")}
      />
      <p className="mt-2 text-xs text-ink-500">Opcional.</p>

      <label className="mt-5 block text-sm font-medium" htmlFor="partner-type">
        Tipo
      </label>
      <select
        className={fieldClass}
        disabled={mutation.isPending}
        id="partner-type"
        {...form.register("type")}
      >
        <option value="ORGANIZATION">Pessoa jurídica</option>
        <option value="PERSON">Pessoa física</option>
      </select>

      <label className="mt-5 block text-sm font-medium" htmlFor="partner-tax-id">
        CPF/CNPJ
      </label>
      <input
        aria-describedby={form.formState.errors.taxId ? "partner-tax-id-error" : undefined}
        autoComplete="off"
        className={fieldClass}
        disabled={mutation.isPending}
        id="partner-tax-id"
        inputMode="numeric"
        {...form.register("taxId")}
      />
      {form.formState.errors.taxId ? (
        <p className="mt-2 text-sm text-alert-600" id="partner-tax-id-error">
          {form.formState.errors.taxId.message}
        </p>
      ) : (
        <p className="mt-2 text-xs text-ink-500">
          A pontuação é opcional; o identificador é a chave do parceiro nesta empresa.
        </p>
      )}

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-ink-950">Papéis</legend>
        <p className="mt-1 text-xs text-ink-500">Ao menos um papel é obrigatório.</p>
        {ROLE_OPTIONS.map((option) => (
          <label
            className="mt-3 flex min-h-11 items-center gap-3 text-sm text-ink-950"
            key={option.value}
          >
            <input
              className="size-4"
              disabled={mutation.isPending}
              type="checkbox"
              value={option.value}
              {...form.register("roles")}
            />
            {option.label}
          </label>
        ))}
        {form.formState.errors.roles ? (
          <p className="mt-2 text-sm text-alert-600" role="alert">
            {form.formState.errors.roles.message}
          </p>
        ) : null}
      </fieldset>

      {mutation.error ? (
        <p className="mt-5 text-sm text-alert-600" role="alert">
          {isConflict
            ? "Já existe um parceiro com este CPF/CNPJ nesta empresa."
            : "Não foi possível cadastrar o parceiro."}
        </p>
      ) : null}

      <button
        className="mt-7 min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        disabled={mutation.isPending}
        type="submit"
      >
        {mutation.isPending ? "Cadastrando…" : "Cadastrar parceiro"}
      </button>
    </form>
  );
}
