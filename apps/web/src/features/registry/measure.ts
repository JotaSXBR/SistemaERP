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
 * Denominador das frações que o setor usa. A tabela oficial da especificação é exatamente a série
 * de trigésimos-avos reduzida — 1/32, 1/16 (2/32), 3/32, 1/8 (4/32)… —, então arredondar para o
 * múltiplo de 1/32 mais próximo escolhe a mesma fração que comparar com a tabela linha a linha.
 */
const FRACTION_DENOMINATOR = 32;

/** Reduz a fração dividindo pelos fatores de dois, os únicos possíveis com denominador 32. */
function reduceFraction(numerator: number): { denominator: number; numerator: number } {
  let currentNumerator = numerator;
  let denominator = FRACTION_DENOMINATOR;
  while (currentNumerator % 2 === 0 && denominator % 2 === 0) {
    currentNumerator /= 2;
    denominator /= 2;
  }

  return { denominator, numerator: currentNumerator };
}

/**
 * Equivalente em polegadas, só para leitura ao lado do campo. O cadastro continua em milímetro;
 * esta é a apresentação que a ADR-0010 manda manter fora do banco.
 *
 * A especificação de exibição de polegadas (`docs/product/inch-display-spec.md`) proíbe decimal de
 * polegada: o valor é sempre uma das frações convencionais, escolhida por proximidade, com empate
 * resolvido para a fração maior — que é o que `Math.round` faz com o meio exato. Abaixo de 1/32″ a
 * exibição é `0"`.
 */
export function formatInches(millimeters: string): string | undefined {
  const parsed = parseMeasureInput(millimeters);
  if (parsed === undefined) return undefined;

  const thirtySeconds = Math.round(
    (Number.parseFloat(parsed) / MILLIMETERS_PER_INCH) * FRACTION_DENOMINATOR,
  );
  if (thirtySeconds === 0) return '0"';

  const whole = Math.floor(thirtySeconds / FRACTION_DENOMINATOR);
  const remainder = thirtySeconds % FRACTION_DENOMINATOR;
  if (remainder === 0) return `${whole}"`;

  const fraction = reduceFraction(remainder);
  const fractionText = `${fraction.numerator}/${fraction.denominator}`;

  return whole === 0 ? `${fractionText}"` : `${whole} ${fractionText}"`;
}

/** Formata a medida vinda da API para exibição, trocando o ponto pela vírgula do português. */
export function formatMeasure(value: string | undefined): string {
  return value === undefined ? "" : value.replace(".", ",");
}
