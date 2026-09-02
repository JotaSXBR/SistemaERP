import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { NfeIntakeSupplierDto } from "@sistema-erp/contracts";

import { createSupplier, enableSupplier } from "../api/fiscal-intake.js";

const supplierSchema = z.object({
  legalName: z.string().trim().min(1, "Informe a razão social").max(160),
});

type SupplierForm = z.infer<typeof supplierSchema>;

const fieldClass =
  "mt-2 min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink-950";

export function SupplierGapForm({
  onCompleted,
  supplier,
}: {
  onCompleted: () => Promise<void>;
  supplier: NfeIntakeSupplierDto;
}) {
  const form = useForm<SupplierForm>({
    defaultValues: { legalName: supplier.name },
    resolver: zodResolver(supplierSchema),
  });
  const mutation = useMutation({
    mutationFn: async (values: SupplierForm) => {
      if (supplier.partnerId) await enableSupplier(supplier.partnerId);
      else await createSupplier({ legalName: values.legalName, taxId: supplier.taxId });
      await onCompleted();
    },
  });
  const submit = form.handleSubmit((values) => mutation.mutate(values));

  const existing = supplier.resolution !== "NOT_FOUND";

  return (
    <form onSubmit={(event) => void submit(event)}>
      <p className="text-sm leading-6 text-ink-700">
        {existing
          ? "Este parceiro já existe, mas precisa ser ativado ou receber o papel de fornecedor."
          : "Confirme os dados extraídos do XML antes de criar o fornecedor."}
      </p>

      <label className="mt-6 block text-sm font-medium" htmlFor="supplier-name">
        Razão social
      </label>
      <input
        aria-describedby={form.formState.errors.legalName ? "supplier-name-error" : undefined}
        className={fieldClass}
        disabled={existing || mutation.isPending}
        id="supplier-name"
        {...form.register("legalName")}
      />
      {form.formState.errors.legalName ? (
        <p className="mt-2 text-sm text-alert-600" id="supplier-name-error">
          {form.formState.errors.legalName.message}
        </p>
      ) : null}

      <div className="mt-5 rounded-xl bg-canvas p-4">
        <p className="text-xs font-semibold text-ink-500 uppercase">CPF/CNPJ do XML</p>
        <p className="mt-1 font-mono text-sm">{supplier.taxId}</p>
      </div>

      {mutation.error ? (
        <p className="mt-5 text-sm text-alert-600" role="alert">
          Não foi possível concluir o cadastro do fornecedor.
        </p>
      ) : null}

      <button
        className="mt-7 min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        disabled={mutation.isPending}
        type="submit"
      >
        {mutation.isPending
          ? "Salvando…"
          : existing
            ? "Habilitar como fornecedor"
            : "Cadastrar fornecedor"}
      </button>
    </form>
  );
}
