import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { NfePersistentIntakeItemDto } from "@sistema-erp/contracts";

import {
  createProduct,
  createSupplierMapping,
  getProduct,
  listProducts,
} from "../api/fiscal-intake.js";

const existingSchema = z.object({ productId: z.string().uuid("Selecione um produto") });
const newProductSchema = z.object({
  decimalScale: z.number().int().min(0).max(10),
  shortDescription: z.string().trim().min(1, "Informe a descrição").max(240),
  sku: z.string().trim().min(1, "Informe o SKU").max(80),
  unitCode: z.string().trim().min(1, "Informe a unidade").max(16),
  unitName: z.string().trim().min(1, "Informe o nome da unidade").max(80),
});

type ExistingForm = z.infer<typeof existingSchema>;
type NewProductForm = z.infer<typeof newProductSchema>;

const fieldClass =
  "mt-2 min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink-950";

export function ProductMappingForm({
  item,
  onCompleted,
  supplierId,
}: {
  item: NfePersistentIntakeItemDto;
  onCompleted: () => Promise<void>;
  supplierId: string;
}) {
  const [mode, setMode] = useState<"existing" | "new">("existing");

  return (
    <div>
      <div className="rounded-2xl bg-canvas p-4">
        <p className="font-medium">{item.description}</p>
        <p className="mt-2 text-sm text-ink-700">
          Código do fornecedor: <span className="font-mono">{item.supplierCode}</span>
        </p>
        <p className="mt-1 text-sm text-ink-700">
          {item.commercialQuantity} {item.commercialUnit}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-canvas p-1">
        {(["existing", "new"] as const).map((value) => (
          <button
            aria-pressed={mode === value}
            className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${
              mode === value ? "bg-panel text-brand-700 shadow-sm" : "text-ink-700"
            }`}
            key={value}
            onClick={() => setMode(value)}
            type="button"
          >
            {value === "existing" ? "Produto existente" : "Criar produto"}
          </button>
        ))}
      </div>

      {mode === "existing" ? (
        <ExistingProductForm item={item} onCompleted={onCompleted} supplierId={supplierId} />
      ) : (
        <NewProductFormView item={item} onCompleted={onCompleted} supplierId={supplierId} />
      )}
    </div>
  );
}

function ExistingProductForm({
  item,
  onCompleted,
  supplierId,
}: {
  item: NfePersistentIntakeItemDto;
  onCompleted: () => Promise<void>;
  supplierId: string;
}) {
  const products = useQuery({ queryFn: () => listProducts(), queryKey: ["catalog", "products"] });
  const form = useForm<ExistingForm>({
    defaultValues: { productId: "" },
    resolver: zodResolver(existingSchema),
  });
  const selectedProductId = form.watch("productId");
  const product = useQuery({
    enabled: selectedProductId.length > 0,
    queryFn: () => getProduct(selectedProductId),
    queryKey: ["catalog", "products", selectedProductId],
  });
  const [presentationId, setPresentationId] = useState("");

  useEffect(() => {
    setPresentationId("");
  }, [selectedProductId]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!presentationId) throw new Error("Presentation is required");
      await createSupplierMapping({
        productPresentationId: presentationId,
        supplierCode: item.supplierCode,
        supplierId,
      });
      await onCompleted();
    },
  });
  const submit = form.handleSubmit(() => mutation.mutate());

  return (
    <form className="mt-6" onSubmit={(event) => void submit(event)}>
      <label className="block text-sm font-medium" htmlFor="existing-product">
        Produto
      </label>
      <select className={fieldClass} id="existing-product" {...form.register("productId")}>
        <option value="">Selecione…</option>
        {products.data?.items.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.sku} · {candidate.shortDescription}
          </option>
        ))}
      </select>
      {form.formState.errors.productId ? (
        <p className="mt-2 text-sm text-alert-600">{form.formState.errors.productId.message}</p>
      ) : null}

      {product.data ? (
        <>
          <label className="mt-5 block text-sm font-medium" htmlFor="product-presentation">
            Apresentação
          </label>
          <select
            className={fieldClass}
            id="product-presentation"
            onChange={(event) => setPresentationId(event.currentTarget.value)}
            value={presentationId}
          >
            <option value="">Selecione…</option>
            {product.data.presentations.map((presentation) => (
              <option key={presentation.id} value={presentation.id}>
                {presentation.name} · {presentation.unit.code}
              </option>
            ))}
          </select>
        </>
      ) : null}

      {products.error || product.error || mutation.error ? (
        <p className="mt-5 text-sm text-alert-600" role="alert">
          Não foi possível consultar ou mapear o produto.
        </p>
      ) : null}

      <button
        className="mt-7 min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white disabled:opacity-60"
        disabled={!presentationId || mutation.isPending}
        type="submit"
      >
        {mutation.isPending ? "Mapeando…" : "Confirmar mapping"}
      </button>
    </form>
  );
}

function NewProductFormView({
  item,
  onCompleted,
  supplierId,
}: {
  item: NfePersistentIntakeItemDto;
  onCompleted: () => Promise<void>;
  supplierId: string;
}) {
  const form = useForm<NewProductForm>({
    defaultValues: {
      decimalScale: 4,
      shortDescription: item.description,
      sku: "",
      unitCode: item.commercialUnit,
      unitName: item.commercialUnit,
    },
    resolver: zodResolver(newProductSchema),
  });
  const mutation = useMutation({
    mutationFn: async (values: NewProductForm) => {
      const product = await createProduct({
        baseUnit: {
          code: values.unitCode,
          decimalScale: values.decimalScale,
          name: values.unitName,
        },
        shortDescription: values.shortDescription,
        sku: values.sku,
      });
      const presentation = product.presentations.find(({ code }) => code === "BASE");
      if (!presentation) throw new Error("Base presentation is missing");
      await createSupplierMapping({
        productPresentationId: presentation.id,
        supplierCode: item.supplierCode,
        supplierId,
      });
      await onCompleted();
    },
  });
  const submit = form.handleSubmit((values) => mutation.mutate(values));

  return (
    <form className="mt-6" onSubmit={(event) => void submit(event)}>
      <FormField
        error={form.formState.errors.sku?.message}
        id="new-product-sku"
        label="SKU interno"
      >
        <input className={fieldClass} id="new-product-sku" {...form.register("sku")} />
      </FormField>
      <FormField
        error={form.formState.errors.shortDescription?.message}
        id="new-product-description"
        label="Descrição curta"
      >
        <input
          className={fieldClass}
          id="new-product-description"
          {...form.register("shortDescription")}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          error={form.formState.errors.unitCode?.message}
          id="new-product-unit"
          label="Unidade base"
        >
          <input className={fieldClass} id="new-product-unit" {...form.register("unitCode")} />
        </FormField>
        <FormField
          error={form.formState.errors.unitName?.message}
          id="new-product-unit-name"
          label="Nome da unidade"
        >
          <input className={fieldClass} id="new-product-unit-name" {...form.register("unitName")} />
        </FormField>
      </div>
      <FormField
        error={form.formState.errors.decimalScale?.message}
        id="new-product-scale"
        label="Casas decimais"
      >
        <input
          className={fieldClass}
          id="new-product-scale"
          max={10}
          min={0}
          type="number"
          {...form.register("decimalScale", { valueAsNumber: true })}
        />
      </FormField>

      {mutation.error ? (
        <p className="mt-5 text-sm text-alert-600" role="alert">
          Não foi possível criar e mapear o produto.
        </p>
      ) : null}
      <button
        className="mt-7 min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white disabled:opacity-60"
        disabled={mutation.isPending}
        type="submit"
      >
        {mutation.isPending ? "Criando…" : "Criar produto e mapear"}
      </button>
    </form>
  );
}

function FormField({
  children,
  error,
  id,
  label,
}: {
  children: ReactNode;
  error?: string | undefined;
  id: string;
  label: string;
}) {
  return (
    <div className="mt-5">
      <label className="block text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? <p className="mt-2 text-sm text-alert-600">{error}</p> : null}
    </div>
  );
}
