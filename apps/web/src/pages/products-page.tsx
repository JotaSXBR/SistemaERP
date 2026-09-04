import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useSession } from "../features/authentication/session-context.js";
import { listCatalogProducts } from "../features/registry/api/registry.js";
import { ProductCreateForm } from "../features/registry/components/product-create-form.js";
import { ProductEditForm } from "../features/registry/components/product-edit-form.js";
import { RegistryListShell } from "../features/registry/components/registry-list-shell.js";
import { SideDrawer } from "../shared/components/side-drawer.js";
import { useDebouncedValue } from "../shared/hooks/use-debounced-value.js";

const SEARCH_DEBOUNCE_MS = 300;

export function ProductsPage() {
  const { identity } = useSession();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  // Uma busca nova invalida a página em que o usuário estava; voltar ao início evita uma lista
  // vazia por deslocamento maior que o novo total.
  useEffect(() => setOffset(0), [debouncedSearch]);

  const products = useQuery({
    placeholderData: keepPreviousData,
    queryFn: () =>
      listCatalogProducts({
        offset,
        ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      }),
    queryKey: ["catalog", "products", "list", { offset, search: debouncedSearch.trim() }],
  });

  const items = products.data?.items ?? [];
  const hasFilter = debouncedSearch.trim().length > 0;
  const canWrite = identity?.role === "OWNER" || identity?.role === "ADMIN";

  async function refreshAfterSave(): Promise<void> {
    setEditingId(undefined);
    await queryClient.invalidateQueries({ queryKey: ["catalog", "products"] });
  }

  async function refreshAfterCreate(): Promise<void> {
    setCreating(false);
    await queryClient.invalidateQueries({ queryKey: ["catalog", "products"] });
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
              Novo produto
            </button>
          ) : undefined
        }
        description="Produtos internos desta empresa. A busca cobre o SKU e a descrição curta."
        emptyMessage={
          hasFilter
            ? "Nenhum produto corresponde à busca."
            : "Nenhum produto cadastrado nesta empresa."
        }
        eyebrow="Cadastros"
        isEmpty={items.length === 0}
        isError={products.isError}
        isPending={products.isPending}
        offset={offset}
        onOffsetChange={setOffset}
        onRetry={() => void products.refetch()}
        onSearchChange={setSearch}
        searchLabel="Buscar produto"
        searchPlaceholder="SKU ou descrição curta"
        searchValue={search}
        title="Produtos"
        total={products.data?.total ?? 0}
      >
        <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
          <thead className="text-xs tracking-[0.08em] text-ink-500 uppercase">
            <tr className="border-b border-line">
              <th className="px-6 py-4 font-semibold" scope="col">
                SKU
              </th>
              <th className="px-6 py-4 font-semibold" scope="col">
                Descrição
              </th>
              <th className="px-6 py-4 font-semibold" scope="col">
                Unidade base
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
            {items.map((product) => (
              <tr className="border-b border-line last:border-b-0" key={product.id}>
                <td className="px-6 py-4 font-medium text-ink-950 tabular-nums">{product.sku}</td>
                <td className="px-6 py-4 text-ink-700">{product.shortDescription}</td>
                <td className="px-6 py-4 text-ink-700">
                  {product.baseUnit.name} ({product.baseUnit.code})
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      product.active ? "bg-brand-50 text-brand-700" : "bg-canvas text-ink-500"
                    }`}
                  >
                    {product.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {canWrite ? (
                    <button
                      aria-label={`Editar ${product.sku}`}
                      className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold text-ink-950 transition hover:bg-canvas"
                      onClick={() => setEditingId(product.id)}
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
        <SideDrawer onClose={() => setCreating(false)} title="Novo produto">
          <ProductCreateForm onCreated={refreshAfterCreate} />
        </SideDrawer>
      ) : null}

      {editingId ? (
        <SideDrawer onClose={() => setEditingId(undefined)} title="Editar produto">
          <ProductEditForm onSaved={refreshAfterSave} productId={editingId} />
        </SideDrawer>
      ) : null}
    </>
  );
}
