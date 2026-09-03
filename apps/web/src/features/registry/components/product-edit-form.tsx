import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { getProductDetail, updateProduct } from "../api/registry.js";

const productSchema = z.object({
  active: z.boolean(),
  shortDescription: z.string().trim().min(1, "Informe a descrição curta").max(240),
  technicalDescription: z.string().max(4000).optional(),
});

type ProductForm = z.infer<typeof productSchema>;

const fieldClass =
  "mt-2 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink-950";

export function ProductEditForm({
  onSaved,
  productId,
}: {
  onSaved: () => Promise<void>;
  productId: string;
}) {
  const detail = useQuery({
    queryFn: () => getProductDetail(productId),
    queryKey: ["catalog", "products", productId],
  });
  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    // O detalhe chega depois da montagem; `values` sincroniza o formulário quando ele carrega.
    values: {
      active: detail.data?.active ?? true,
      shortDescription: detail.data?.shortDescription ?? "",
      technicalDescription: detail.data?.technicalDescription ?? "",
    },
  });
  const mutation = useMutation({
    mutationFn: async (input: ProductForm) => {
      await updateProduct(productId, {
        active: input.active,
        shortDescription: input.shortDescription.trim(),
        // Texto vazio é o contrato da API para remover a descrição técnica.
        technicalDescription: input.technicalDescription?.trim() ?? "",
      });
      await onSaved();
    },
  });
  const submit = form.handleSubmit((values) => mutation.mutate(values));

  if (detail.isPending) {
    return (
      <p className="text-sm text-ink-500" role="status">
        Carregando produto…
      </p>
    );
  }

  if (detail.error || !detail.data) {
    return (
      <p className="text-sm text-alert-600" role="alert">
        Não foi possível carregar o produto.
      </p>
    );
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <div className="rounded-xl bg-canvas p-4">
        <p className="text-xs font-semibold text-ink-500 uppercase">Identificação</p>
        <p className="mt-2 font-mono text-sm font-medium text-ink-950">{detail.data.sku}</p>
        <p className="mt-1 text-sm text-ink-700">
          Unidade base: {detail.data.baseUnit.name} ({detail.data.baseUnit.code})
        </p>
        <p className="mt-3 text-xs leading-5 text-ink-500">
          SKU e unidade base não são editáveis: apresentações e mapeamentos de fornecedor
          referenciam ambos.
        </p>
      </div>

      <label className="mt-6 block text-sm font-medium" htmlFor="product-short-description">
        Descrição curta
      </label>
      <input
        aria-describedby={
          form.formState.errors.shortDescription ? "product-short-description-error" : undefined
        }
        className={fieldClass}
        disabled={mutation.isPending}
        id="product-short-description"
        {...form.register("shortDescription")}
      />
      {form.formState.errors.shortDescription ? (
        <p className="mt-2 text-sm text-alert-600" id="product-short-description-error">
          {form.formState.errors.shortDescription.message}
        </p>
      ) : null}

      <label className="mt-5 block text-sm font-medium" htmlFor="product-technical-description">
        Descrição técnica
      </label>
      <textarea
        className={fieldClass}
        disabled={mutation.isPending}
        id="product-technical-description"
        rows={4}
        {...form.register("technicalDescription")}
      />
      <p className="mt-2 text-xs text-ink-500">Deixe em branco para remover a descrição técnica.</p>

      <label className="mt-5 flex min-h-11 items-center gap-3 text-sm text-ink-950">
        <input
          className="size-4"
          disabled={mutation.isPending}
          type="checkbox"
          {...form.register("active")}
        />
        Produto ativo
      </label>

      <div className="mt-5 rounded-xl bg-canvas p-4">
        <p className="text-xs font-semibold text-ink-500 uppercase">Apresentações</p>
        <ul className="mt-2 text-sm text-ink-700">
          {detail.data.presentations.map((presentation) => (
            <li className="mt-1" key={presentation.id}>
              {presentation.code} · {presentation.name} ({presentation.unit.code})
            </li>
          ))}
        </ul>
      </div>

      {mutation.error ? (
        <p className="mt-5 text-sm text-alert-600" role="alert">
          Não foi possível salvar o produto.
        </p>
      ) : null}

      <button
        className="mt-7 min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        disabled={mutation.isPending}
        type="submit"
      >
        {mutation.isPending ? "Salvando…" : "Salvar produto"}
      </button>
    </form>
  );
}
