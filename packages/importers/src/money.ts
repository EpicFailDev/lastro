/**
 * Converte um valor monetário em string para centavos (inteiro).
 * @param raw texto do valor (pode ter símbolo, separador de milhar, parênteses)
 * @param decimalSeparator ',' (pt-BR) ou '.' (en-US)
 */
export function parseAmountToCents(raw: string, decimalSeparator: ',' | '.'): number {
  let s = raw.trim();
  let negative = false;

  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.includes('-')) negative = true;

  // Mantém só dígitos e o separador decimal.
  const thousand = decimalSeparator === ',' ? '.' : ',';
  s = s.split(thousand).join('');
  s = s.replace(
    new RegExp(`[^0-9${decimalSeparator === '.' ? '\\.' : decimalSeparator}]`, 'g'),
    '',
  );
  s = s.replace(decimalSeparator, '.');

  const value = Number(s);
  if (Number.isNaN(value)) {
    throw new Error(`Valor monetário inválido: "${raw}"`);
  }
  const cents = Math.round(value * 100);
  return negative ? -cents : cents;
}
