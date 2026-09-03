import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { NfePersistentIntakeDto, NfePersistentIntakeItemDto } from "@sistema-erp/contracts";

import { useSession } from "../features/authentication/session-context.js";
import {
  getFiscalDocument,
  ingestNfe,
  listFiscalDocuments,
  resolveFiscalDocument,
} from "../features/fiscal-intake/api/fiscal-intake.js";
import { IntakeDrawer } from "../features/fiscal-intake/components/intake-drawer.js";
import { ProductMappingForm } from "../features/fiscal-intake/components/product-mapping-form.js";
import { SupplierGapForm } from "../features/fiscal-intake/components/supplier-gap-form.js";

const DOCUMENTS_QUERY_KEY = ["fiscal-intake", "documents"] as const;
const MAX_XML_BYTES = 5 * 1024 * 1024;

const STATUS_LABELS: Record<string, string> = {
  PENDING_MAPPING: "Mapeamento pendente",
  PENDING_SUPPLIER: "Fornecedor pendente",
  PENDING_VALIDATION: "Validação pendente",
  READY_FOR_REVIEW: "Pronto para revisão",
  VALIDATION_FAILED: "Validação falhou",
};

const VALIDATION_ISSUE_LABELS: Record<string, string> = {
  ORGANIZATION_TAX_ID_NOT_CONFIGURED:
    "A empresa atual ainda não possui CPF/CNPJ fiscal configurado.",
  RECIPIENT_TAX_ID_MISMATCH: "O destinatário do XML não corresponde à empresa atual.",
};

function documentQueryKey(documentId: string) {
  return ["fiscal-intake", "documents", documentId] as const;
}

export function FiscalIntakePage() {
  const { identity } = useSession();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [file, setFile] = useState<File>();
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [fileError, setFileError] = useState<string>();
  const [supplierDrawerOpen, setSupplierDrawerOpen] = useState(false);
  const [mappingItem, setMappingItem] = useState<NfePersistentIntakeItemDto>();
  const canWrite = identity?.role === "OWNER" || identity?.role === "ADMIN";
  const inbox = useQuery({ queryFn: listFiscalDocuments, queryKey: DOCUMENTS_QUERY_KEY });

  useEffect(() => {
    if (!selectedId && inbox.data?.items[0]) setSelectedId(inbox.data.items[0].documentId);
  }, [inbox.data, selectedId]);

  const document = useQuery({
    enabled: Boolean(selectedId),
    queryFn: () => getFiscalDocument(selectedId!),
    queryKey: documentQueryKey(selectedId ?? "none"),
  });
  const upload = useMutation({
    mutationFn: (selectedFile: File) => ingestNfe(selectedFile, crypto.randomUUID()),
    onSuccess: async (created) => {
      queryClient.setQueryData(documentQueryKey(created.documentId), created);
      setSelectedId(created.documentId);
      setFile(undefined);
      setUploadInputKey((current) => current + 1);
      await queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
    },
  });

  async function refreshDocument(): Promise<void> {
    if (!selectedId) return;
    const resolved = await resolveFiscalDocument(selectedId);
    queryClient.setQueryData(documentQueryKey(selectedId), resolved);
    await queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY });
  }

  function chooseFile(selected: File | undefined) {
    setFileError(undefined);
    setFile(undefined);
    if (!selected) return;
    if (selected.size > MAX_XML_BYTES) {
      setFileError("O XML excede o limite de 5 MiB.");
      return;
    }
    if (!selected.name.toLowerCase().endsWith(".xml")) {
      setFileError("Selecione um arquivo XML.");
      return;
    }
    setFile(selected);
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="flex flex-col gap-6 border-b border-line pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-brand-700 uppercase">
            Entrada fiscal
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">Inbox de NF-e</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-700">
            Importe o XML, resolva fornecedor e produtos e preserve a origem antes de qualquer
            efeito no estoque.
          </p>
        </div>

        <div className="w-full max-w-lg rounded-2xl border border-line bg-panel p-4 shadow-panel">
          <label className="block text-sm font-semibold" htmlFor="nfe-upload">
            XML da NF-e
          </label>
          <input
            accept="application/xml,text/xml,.xml"
            className="mt-3 block w-full text-sm text-ink-700 file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:font-semibold file:text-brand-700"
            disabled={!canWrite || upload.isPending}
            id="nfe-upload"
            key={uploadInputKey}
            onChange={(event) => chooseFile(event.currentTarget.files?.[0])}
            type="file"
          />
          {!canWrite ? (
            <p className="mt-3 text-xs text-ink-500">
              Somente proprietários e administradores importam.
            </p>
          ) : null}
          {fileError ? <p className="mt-3 text-sm text-alert-600">{fileError}</p> : null}
          {upload.error ? (
            <p className="mt-3 text-sm text-alert-600" role="alert">
              Não foi possível importar este XML.
            </p>
          ) : null}
          <button
            className="mt-4 min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            disabled={!file || upload.isPending || !canWrite}
            onClick={() => file && upload.mutate(file)}
            type="button"
          >
            {upload.isPending ? "Importando…" : "Importar XML"}
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <InboxList
          error={Boolean(inbox.error)}
          loading={inbox.isPending}
          onRetry={() => void inbox.refetch()}
          onSelect={setSelectedId}
          selectedId={selectedId}
          documents={inbox.data?.items ?? []}
        />

        <section aria-label="Prévia do documento" className="min-w-0">
          {document.isPending && selectedId ? (
            <PanelMessage message="Carregando documento…" />
          ) : document.error ? (
            <PanelMessage
              action={() => void document.refetch()}
              actionLabel="Tentar novamente"
              error
              message="Não foi possível carregar o documento."
            />
          ) : document.data ? (
            <DocumentPreview
              canWrite={canWrite}
              document={document.data}
              onMapItem={setMappingItem}
              onRevalidate={() => void refreshDocument()}
              onResolveSupplier={() => setSupplierDrawerOpen(true)}
            />
          ) : (
            <PanelMessage message="Importe ou selecione um documento para abrir a prévia." />
          )}
        </section>
      </div>

      {supplierDrawerOpen && document.data ? (
        <IntakeDrawer onClose={() => setSupplierDrawerOpen(false)} title="Resolver fornecedor">
          <SupplierGapForm
            onCompleted={async () => {
              await refreshDocument();
              setSupplierDrawerOpen(false);
            }}
            supplier={document.data.supplier}
          />
        </IntakeDrawer>
      ) : null}

      {mappingItem && document.data?.supplier.partnerId ? (
        <IntakeDrawer onClose={() => setMappingItem(undefined)} title="Mapear produto">
          <ProductMappingForm
            item={mappingItem}
            onCompleted={async () => {
              await refreshDocument();
              setMappingItem(undefined);
            }}
            supplierId={document.data.supplier.partnerId}
          />
        </IntakeDrawer>
      ) : null}
    </div>
  );
}

function InboxList({
  documents,
  error,
  loading,
  onRetry,
  onSelect,
  selectedId,
}: {
  documents: Array<{
    documentId: string;
    documentNumber: string;
    itemCount: number;
    status: string;
    supplierName: string;
  }>;
  error: boolean;
  loading: boolean;
  onRetry: () => void;
  onSelect: (id: string) => void;
  selectedId?: string | undefined;
}) {
  return (
    <aside
      aria-label="Documentos importados"
      className="rounded-3xl border border-line bg-panel p-4 shadow-panel"
    >
      <div className="flex items-center justify-between px-2 py-2">
        <h2 className="font-semibold">Documentos recentes</h2>
        <span className="text-xs text-ink-500">{documents.length}</span>
      </div>
      {loading ? <p className="p-3 text-sm text-ink-500">Carregando…</p> : null}
      {error ? (
        <div className="p-3" role="alert">
          <p className="text-sm text-alert-600">Não foi possível carregar a inbox.</p>
          <button
            className="mt-3 text-sm font-semibold text-brand-700"
            onClick={onRetry}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      ) : null}
      {!loading && !error && documents.length === 0 ? (
        <p className="p-3 text-sm leading-6 text-ink-500">Nenhum XML importado nesta empresa.</p>
      ) : null}
      <div className="mt-2 space-y-2">
        {documents.map((document) => (
          <button
            aria-pressed={selectedId === document.documentId}
            className={`w-full rounded-2xl border p-4 text-left transition ${
              selectedId === document.documentId
                ? "border-brand-500 bg-brand-50"
                : "border-line hover:bg-canvas"
            }`}
            key={document.documentId}
            onClick={() => onSelect(document.documentId)}
            type="button"
          >
            <p className="truncate text-sm font-semibold">{document.supplierName}</p>
            <p className="mt-1 text-xs text-ink-500">
              NF {document.documentNumber} · {document.itemCount} item(ns)
            </p>
            <StatusBadge status={document.status} />
          </button>
        ))}
      </div>
    </aside>
  );
}

function DocumentPreview({
  canWrite,
  document,
  onMapItem,
  onRevalidate,
  onResolveSupplier,
}: {
  canWrite: boolean;
  document: NfePersistentIntakeDto;
  onMapItem: (item: NfePersistentIntakeItemDto) => void;
  onRevalidate: () => void;
  onResolveSupplier: () => void;
}) {
  const supplierPending = document.status === "PENDING_SUPPLIER";
  const validationFailed = document.validation.status === "FAILED";

  return (
    <div className="space-y-6">
      {validationFailed ? (
        <div className="rounded-2xl border border-orange-200 bg-alert-50 p-5" role="alert">
          <p className="font-semibold">O documento falhou na validação</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-700">
            {document.validation.issues.map((issue) => (
              <li key={issue}>{VALIDATION_ISSUE_LABELS[issue] ?? issue}</li>
            ))}
          </ul>
          {canWrite ? (
            <button
              className="mt-4 min-h-11 rounded-xl bg-alert-600 px-5 text-sm font-semibold text-white"
              onClick={onRevalidate}
              type="button"
            >
              Revalidar documento
            </button>
          ) : null}
        </div>
      ) : null}

      {supplierPending ? (
        <div className="rounded-2xl border border-orange-200 bg-alert-50 p-5" role="status">
          <p className="font-semibold">Fornecedor precisa de atenção</p>
          <p className="mt-2 text-sm text-ink-700">
            {document.supplier.name} · {document.supplier.taxId}
          </p>
          {canWrite ? (
            <button
              className="mt-4 min-h-11 rounded-xl bg-alert-600 px-5 text-sm font-semibold text-white"
              onClick={onResolveSupplier}
              type="button"
            >
              Resolver fornecedor
            </button>
          ) : null}
        </div>
      ) : null}

      {document.status === "READY_FOR_REVIEW" ? (
        <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5" role="status">
          <p className="font-semibold text-brand-700">Documento pronto para revisão</p>
          <p className="mt-2 text-sm text-ink-700">
            Todos os itens estão mapeados. A confirmação de recebimento será habilitada na Fase 8.3.
          </p>
        </div>
      ) : null}

      <div className="rounded-3xl border border-line bg-panel p-6 shadow-panel">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-ink-500">Fornecedor</p>
            <h2 className="mt-1 text-xl font-semibold">{document.supplier.name}</h2>
            <p className="mt-2 font-mono text-xs text-ink-500 break-all">{document.accessKey}</p>
          </div>
          <StatusBadge status={document.status} />
        </div>
        <dl className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
          <Summary label="Nota / série" value={`${document.documentNumber} / ${document.series}`} />
          <Summary label="Total do XML" value={`R$ ${document.documentTotal}`} />
          <Summary
            label="Itens resolvidos"
            value={`${document.summary.matched} de ${document.items.length}`}
          />
        </dl>
      </div>

      <div className="overflow-hidden rounded-3xl border border-line bg-panel shadow-panel">
        <div className="border-b border-line px-6 py-5">
          <h2 className="font-semibold">Itens do XML</h2>
        </div>
        <div className="divide-y divide-line">
          {document.items.map((item) => (
            <div className="grid gap-4 p-6 lg:grid-cols-[1fr_auto] lg:items-center" key={item.id}>
              <div className="min-w-0">
                <p className="font-medium">{item.description}</p>
                <p className="mt-2 text-sm text-ink-500">
                  Código {item.supplierCode} · {item.commercialQuantity} {item.commercialUnit} · NCM{" "}
                  {item.ncm}
                </p>
                {item.resolution.product ? (
                  <p className="mt-2 text-sm text-brand-700">
                    {item.resolution.product.sku} · {item.resolution.product.shortDescription}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={item.resolution.status} />
                {item.resolution.status === "UNMAPPED" && canWrite && !validationFailed ? (
                  <button
                    className="min-h-11 rounded-xl border border-brand-500 px-4 text-sm font-semibold text-brand-700"
                    onClick={() => onMapItem(item)}
                    type="button"
                  >
                    Mapear produto
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const positive = status === "READY_FOR_REVIEW" || status === "MATCHED";
  return (
    <span
      className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        positive ? "bg-brand-100 text-brand-700" : "bg-alert-50 text-alert-600"
      }`}
    >
      {STATUS_LABELS[status] ??
        (status === "MATCHED" ? "Mapeado" : status === "UNMAPPED" ? "Não mapeado" : status)}
    </span>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function PanelMessage({
  action,
  actionLabel,
  error,
  message,
}: {
  action?: () => void;
  actionLabel?: string;
  error?: boolean;
  message: string;
}) {
  return (
    <div
      className="rounded-3xl border border-line bg-panel p-8 shadow-panel"
      role={error ? "alert" : "status"}
    >
      <p className={error ? "text-sm text-alert-600" : "text-sm text-ink-500"}>{message}</p>
      {action && actionLabel ? (
        <button
          className="mt-4 text-sm font-semibold text-brand-700"
          onClick={action}
          type="button"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
