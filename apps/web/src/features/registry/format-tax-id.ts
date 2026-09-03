const CNPJ_LENGTH = 14;
const CPF_LENGTH = 11;

/**
 * A API persiste o identificador fiscal apenas com dígitos. A pontuação é reconstruída na exibição
 * para leitura humana; nada aqui altera o valor armazenado.
 */
export function formatTaxId(taxId: string): string {
  if (taxId.length === CNPJ_LENGTH) {
    return taxId.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }

  if (taxId.length === CPF_LENGTH) {
    return taxId.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }

  return taxId;
}
