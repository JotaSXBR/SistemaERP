const STORAGE_KEY = "sistema-erp.session-token";

type Listener = () => void;

const listeners = new Set<Listener>();

let memoryToken: string | undefined;

/**
 * O token é opaco e vale por oito horas. Ele fica em memória durante a navegação e é espelhado
 * em `sessionStorage` para sobreviver a um reload da mesma aba. Não usamos `localStorage` para
 * não manter a credencial disponível a outras abas e sessões do navegador depois de fechada.
 */
function readStorage(): string | undefined {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    // Armazenamento indisponível (aba privada ou bloqueio do navegador): a sessão vive em memória.
    return undefined;
  }
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function readSessionToken(): string | undefined {
  memoryToken ??= readStorage();

  return memoryToken;
}

export function writeSessionToken(token: string): void {
  memoryToken = token;

  try {
    window.sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // A persistência por aba é uma conveniência; a sessão continua válida apenas em memória.
  }

  notify();
}

export function clearSessionToken(): void {
  memoryToken = undefined;

  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nada a limpar quando o armazenamento não está disponível.
  }

  notify();
}

export function subscribeToSessionToken(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
