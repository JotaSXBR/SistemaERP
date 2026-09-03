import { useEffect, useState } from "react";

/**
 * Atrasa a propagação de um valor que muda a cada tecla digitada. As listagens usam isso para não
 * disparar uma requisição por caractere de busca.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
