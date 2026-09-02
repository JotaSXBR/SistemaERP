import { useEffect, useRef, type ReactNode } from "react";

export function IntakeDrawer({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink-950/35" role="presentation">
      <section
        aria-labelledby="intake-drawer-title"
        aria-modal="true"
        className="h-full w-full max-w-xl overflow-y-auto border-l border-line bg-panel p-6 shadow-2xl sm:p-8"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
          <h2 className="text-xl font-semibold tracking-tight" id="intake-drawer-title">
            {title}
          </h2>
          <button
            aria-label="Fechar"
            className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold text-ink-700 hover:bg-canvas"
            onClick={onClose}
            ref={closeButton}
            type="button"
          >
            Fechar
          </button>
        </div>
        <div className="pt-6">{children}</div>
      </section>
    </div>
  );
}
