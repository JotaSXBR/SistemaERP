import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { useSession } from "../session-context.js";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  MEMBER: "Membro",
  OWNER: "Proprietário",
};

export function SessionMenu() {
  const { identity, signOut, status } = useSession();
  const navigate = useNavigate();
  const [isLeaving, setIsLeaving] = useState(false);

  if (status === "loading") {
    return <span className="text-xs text-ink-500">Validando sessão…</span>;
  }

  if (!identity) {
    return (
      <Link
        className="inline-flex min-h-9 items-center rounded-full border border-line bg-panel px-3.5 text-xs font-semibold text-ink-700 transition hover:text-ink-950"
        to="/login"
      >
        Entrar
      </Link>
    );
  }

  async function leave(): Promise<void> {
    setIsLeaving(true);

    try {
      await signOut();
      await navigate("/login", { replace: true });
    } catch {
      // A sessão local já foi descartada; manter o botão utilizável para uma nova tentativa.
      setIsLeaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-700 sm:inline-flex">
        <span aria-hidden="true" className="size-2 rounded-full bg-brand-500" />
        {ROLE_LABELS[identity.role] ?? identity.role}
      </span>
      <button
        className="min-h-9 rounded-full border border-line bg-panel px-3.5 text-xs font-semibold text-ink-700 transition hover:text-ink-950 disabled:cursor-wait disabled:opacity-60"
        disabled={isLeaving}
        onClick={() => void leave()}
        type="button"
      >
        {isLeaving ? "Saindo…" : "Sair"}
      </button>
    </div>
  );
}
