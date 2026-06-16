/** Converte uma data de extrato para 'YYYY-MM-DD'. */
export function parseStatementDate(raw: string, format: 'dd/mm/yyyy' | 'yyyy-mm-dd'): string {
  const s = raw.trim();
  if (format === 'yyyy-mm-dd') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) throw new Error(`Data inválida: "${raw}"`);
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) throw new Error(`Data inválida: "${raw}"`);
  const day = m[1]!.padStart(2, '0');
  const month = m[2]!.padStart(2, '0');
  return `${m[3]}-${month}-${day}`;
}
