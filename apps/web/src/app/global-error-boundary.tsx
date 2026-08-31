import { Component, type ReactNode } from "react";

type GlobalErrorBoundaryProps = { children: ReactNode };
type GlobalErrorBoundaryState = { hasError: boolean };

export class GlobalErrorBoundary extends Component<
  GlobalErrorBoundaryProps,
  GlobalErrorBoundaryState
> {
  override state: GlobalErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): GlobalErrorBoundaryState {
    return { hasError: true };
  }

  override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <section className="w-full max-w-lg rounded-3xl border border-line bg-panel p-8 text-center shadow-panel">
          <p className="text-sm font-semibold text-alert-600">Falha inesperada</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            A interface não pôde continuar
          </h1>
          <p className="mt-3 text-sm leading-6 text-ink-700">
            Recarregue a aplicação. Se o problema persistir, use o identificador da requisição
            exibido na página de diagnóstico.
          </p>
          <button
            className="mt-6 min-h-11 rounded-xl bg-ink-950 px-5 text-sm font-semibold text-white hover:bg-brand-700"
            onClick={() => window.location.reload()}
            type="button"
          >
            Recarregar aplicação
          </button>
        </section>
      </main>
    );
  }
}
