/**
 * Formata um valor em centavos (inteiro) como moeda BRL.
 * Valor negativo representa despesa.
 */
export function formatMoney(amountCents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amountCents / 100);
}
