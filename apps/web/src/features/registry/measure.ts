/** Milímetros por polegada. A conversão é exata, por isso a polegada nunca vira coluna própria. */
const MILLIMETERS_PER_INCH = 25.4;

/** Aceita vírgula porque é o separador decimal que o usuário digita; a API só entende ponto. */
const MEASURE_INPUT = /^\d{1,14}([.,]\d{1,10})?$/;

/**
 * Normaliza o que foi digitado para a string decimal que a API espera. Devolve `undefined` quando o
 * texto não é uma medida válida — quem chama decide se isso é erro de formulário ou campo vazio.
 */
export function parseMeasureInput(value: string): string | undefined {
  const trimmed = value.trim();
  if (!MEASURE_INPUT.test(trimmed)) return undefined;

  const normalized = trimmed.replace(",", ".");
  // Zero é recusado pela API: quem não tem a medida deixa o campo vazio, e isso vira `null`.
  return Number.parseFloat(normalized) > 0 ? normalized : undefined;
}

/** Verdadeiro para o que o formulário aceita: campo vazio ou uma medida positiva bem formada. */
export function isMeasureInput(value: string | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 || parseMeasureInput(trimmed) !== undefined;
}

/**
 * Equivalente em polegadas, só para leitura ao lado do campo. O cadastro continua sendo o valor em
 * milímetro; esta é a apresentação que a ADR-0010 manda manter fora do banco.
 */
export function toInches(millimeters: string): string | undefined {
  const parsed = parseMeasureInput(millimeters);
  if (parsed === undefined) return undefined;

  const inches = Number.parseFloat(parsed) / MILLIMETERS_PER_INCH;
  // Três casas bastam para reconhecer as medidas do setor (1/8" = 0,125") sem fingir precisão.
  return inches.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

/** Formata a medida vinda da API para exibição, trocando o ponto pela vírgula do português. */
export function formatMeasure(value: string | undefined): string {
  return value === undefined ? "" : value.replace(".", ",");
}
