import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { createProduct, RegistryRequestError } from "../api/registry.js";

const CONFLICT_STATUS = 409;
const MAX_DECIMAL_SCALE = 10;

/** Mesmo alfabeto que a API aceita em SKU e código de unidade (`CODE_PATTERN`). */
const CODE_PATTERN = /^[-A-Za-z0-9._/]+$/;

const productSchema = z.object({
  baseUnitCode: z
    .string()
    .trim()
    .min(1, "Informe o código da unidade")
    .max(16, "Use no máximo 16 caracteres")
    .regex(CODE_PATTERN, "Use apenas letras, números e - . _ /"),
  baseUnitDecimalScale: z
    .number({ message: "Informe um número inteiro" })
    .int("Informe um número inteiro")
    .min(0, "Não pode ser negativo")
    .max(MAX_DECIMAL_SCALE, `Use no máximo ${MAX_DECIMAL_SCALE}`),
  baseUnitName: z.string().trim().min(1, "Informe o nome da unidade").max(80),
  shortDescription: z.string().trim().min(1, "Informe a descrição curta").max(240),
  sku: z
    .string()
    .trim()
    .min(1, "Informe o SKU")
    .max(120, "Use no máximo 120 caracteres")
    .regex(CODE_PATTERN, "Use apenas letras, números e - . _ /"),
  technicalDescription: z.string().max(4000).optional(),
});

type ProductForm = z.infer<typeof productSchema>;

const fieldClass =
  "mt-2 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink-950";

export function ProductCreateForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const form = useForm<ProductForm>({
    defaultValues: {
      baseUnitCode: "",
      baseUnitDecimalScale: 0,
      baseUnitName: "",
      shortDescription: "",
      sku: "",
      technicalDescription: "",
    },
    resolver: zodResolver(productSchema),
  });
  const mutation = useMutation({
    mutationFn: async (input: ProductForm) => {
      const technicalDescription = input.technicalDescription?.trim();
      await createProduct({
        baseUnit: {
          code: input.baseUnitCode.trim(),
          decimalScale: input.baseUnitDecimalScale,
          name: input.baseUnitName.trim(),
        },
        shortDescription: input.shortDescription.trim(),
        sku: input.sku.trim(),
        ...(technicalDescription ? { technicalDescription } : {}),
      });
      await onCreated();
    },
  });
  const submit = form.handleSubmit((values) => mutation.mutate(values));

  const isConflict =
    mutation.error instanceof RegistryRequestError && mutation.error.status === CONFLICT_STATUS;

  return (
    <form onSubmit={(event) => void submit(event)}>
      <label className="block text-sm font-medium" htmlFor="new-product-sku">
        SKU
      </label>
      <input
        aria-describedby={form.formState.errors.sku ? "new-product-sku-error" : undefined}
        autoComplete="off"
        className={fieldClass}
        disabled={mutation.isPending}
        id="new-product-sku"
        {...form.register("sku")}
      />
      {form.formState.errors.sku ? (
        <p className="mt-2 text-sm text-alert-600" id="new-product-sku-error">
          {form.formState.errors.sku.message}
        </p>
      ) : (
        <p className="mt-2 text-xs text-ink-500">
          Código interno e opaco: não embuta classificação nem medida, que mudam com o tempo.
        </p>
      )}

      <label className="mt-5 block text-sm font-medium" htmlFor="new-product-short-description">
        Descrição curta
      </label>
      <input
        aria-describedby={
          form.formState.errors.shortDescription ? "new-product-short-description-error" : undefined
        }
        className={fieldClass}
        disabled={mutation.isPending}
        id="new-product-short-description"
        {...form.register("shortDescription")}
      />
      {form.formState.errors.shortDescription ? (
        <p className="mt-2 text-sm text-alert-600" id="new-product-short-description-error">
          {form.formState.errors.shortDescription.message}
        </p>
      ) : null}

      <label className="mt-5 block text-sm font-medium" htmlFor="new-product-technical-description">
        Descrição técnica
      </label>
      <textarea
        className={fieldClass}
        disabled={mutation.isPending}
        id="new-product-technical-description"
        rows={4}
        {...form.register("technicalDescription")}
      />
      <p className="mt-2 text-xs text-ink-500">Opcional.</p>

      <fieldset className="mt-6 rounded-xl bg-canvas p-4">
        <legend className="text-xs font-semibold text-ink-500 uppercase">Unidade base</legend>
        <p className="mt-1 text-xs leading-5 text-ink-500">
          A unidade base não é editável depois: apresentações e mapeamentos de fornecedor
          referenciam ela.
        </p>

        <label className="mt-4 block text-sm font-medium" htmlFor="new-product-unit-code">
          Código
        </label>
        <input
          aria-describedby={
            form.formState.errors.baseUnitCode ? "new-product-unit-code-error" : undefined
          }
          autoComplete="off"
          className={fieldClass}
          disabled={mutation.isPending}
          id="new-product-unit-code"
          placeholder="KG"
          {...form.register("baseUnitCode")}
        />
        {form.formState.errors.baseUnitCode ? (
          <p className="mt-2 text-sm text-alert-600" id="new-product-unit-code-error">
            {form.formState.errors.baseUnitCode.message}
          </p>
        ) : null}

        <label className="mt-4 block text-sm font-medium" htmlFor="new-product-unit-name">
          Nome
        </label>
        <input
          aria-describedby={
            form.formState.errors.baseUnitName ? "new-product-unit-name-error" : undefined
          }
          autoComplete="off"
          className={fieldClass}
          disabled={mutation.isPending}
          id="new-product-unit-name"
          placeholder="Quilograma"
          {...form.register("baseUnitName")}
        />
        {form.formState.errors.baseUnitName ? (
          <p className="mt-2 text-sm text-alert-600" id="new-product-unit-name-error">
            {form.formState.errors.baseUnitName.message}
          </p>
        ) : null}

        <label className="mt-4 block text-sm font-medium" htmlFor="new-product-unit-scale">
          Casas decimais
        </label>
        <input
          aria-describedby={
            form.formState.errors.baseUnitDecimalScale ? "new-product-unit-scale-error" : undefined
          }
          className={fieldClass}
          disabled={mutation.isPending}
          id="new-product-unit-scale"
          max={MAX_DECIMAL_SCALE}
          min={0}
          type="number"
          {...form.register("baseUnitDecimalScale", { valueAsNumber: true })}
        />
        {form.formState.errors.baseUnitDecimalScale ? (
          <p className="mt-2 text-sm text-alert-600" id="new-product-unit-scale-error">
            {form.formState.errors.baseUnitDecimalScale.message}
          </p>
        ) : (
          <p className="mt-2 text-xs text-ink-500">
            Precisão das quantidades nesta unidade. Use 0 para itens contados por peça.
          </p>
        )}
      </fieldset>

      {mutation.error ? (
        <p className="mt-5 text-sm text-alert-600" role="alert">
          {isConflict
            ? "Já existe um produto com este SKU nesta empresa."
            : "Não foi possível cadastrar o produto."}
        </p>
      ) : null}

      <button
        className="mt-7 min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        disabled={mutation.isPending}
        type="submit"
      >
        {mutation.isPending ? "Cadastrando…" : "Cadastrar produto"}
      </button>
    </form>
  );
}
