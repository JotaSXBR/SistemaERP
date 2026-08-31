import { NavLink, Outlet } from "react-router";

function BrandMark() {
  return (
    <div className="flex size-10 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold tracking-tight text-white shadow-sm">
      SE
    </div>
  );
}

export function AppLayout() {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="hidden border-r border-line bg-panel/90 px-5 py-6 backdrop-blur lg:flex lg:flex-col">
        <div className="flex items-center gap-3 px-2">
          <BrandMark />
          <div>
            <p className="font-semibold tracking-tight text-ink-950">Sistema ERP</p>
            <p className="text-xs text-ink-500">Painel operacional</p>
          </div>
        </div>

        <nav aria-label="Navegação principal" className="mt-10">
          <p className="px-3 text-[0.68rem] font-semibold tracking-[0.16em] text-ink-500 uppercase">
            Sistema
          </p>
          <NavLink
            className={({ isActive }) =>
              `mt-3 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-ink-700 hover:bg-canvas hover:text-ink-950"
              }`
            }
            to="/diagnostics"
          >
            <span aria-hidden="true" className="size-2 rounded-full bg-current" />
            Diagnóstico
          </NavLink>
        </nav>

        <div className="mt-auto rounded-2xl border border-line bg-canvas p-4">
          <p className="text-xs font-semibold text-ink-700">Fundação técnica</p>
          <p className="mt-1 text-xs leading-5 text-ink-500">Fase 5 · Interface web</p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="flex h-18 items-center justify-between border-b border-line bg-panel/80 px-5 backdrop-blur sm:px-8 lg:px-10">
          <div className="flex items-center gap-3 lg:hidden">
            <BrandMark />
            <span className="text-sm font-semibold">Sistema ERP</span>
          </div>
          <div className="hidden lg:block">
            <p className="text-xs font-medium text-ink-500">Visão operacional</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-700">
            <span aria-hidden="true" className="size-2 rounded-full bg-brand-500" />
            Desenvolvimento
          </div>
        </header>

        <main className="px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
