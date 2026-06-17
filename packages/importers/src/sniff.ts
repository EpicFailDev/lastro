const CANDIDATES = [',', ';', '\t', '|'];

/** Escolhe o delimitador que produz contagem de colunas mais consistente (>1). */
export function sniffDelimiter(content: string): string {
  const lines = content.trim().split(/\r?\n/).slice(0, 10);
  let best = ',';
  let bestScore = -Infinity;
  for (const delim of CANDIDATES) {
    const counts = lines.map((l) => l.split(delim).length);
    const cols = counts[0] ?? 1;
    if (cols < 2) continue;
    const consistent = counts.filter((c) => c === cols).length;
    const score = consistent * 100 + cols; // consistência domina; desempata por nº de colunas
    if (score > bestScore) {
      bestScore = score;
      best = delim;
    }
  }
  return best;
}

/** Infere o separador decimal pelas amostras de valor. Empate → ',' (pt-BR). */
export function detectDecimalSeparator(samples: string[]): ',' | '.' {
  let comma = 0;
  let dot = 0;
  for (const raw of samples) {
    const s = raw.trim();
    // O último separador antes de 2 dígitos finais é o decimal.
    const m = /[.,](\d{1,2})$/.exec(s);
    if (!m) continue;
    const sep = s[s.length - m[1]!.length - 1];
    if (sep === ',') comma++;
    else if (sep === '.') dot++;
  }
  return dot > comma ? '.' : ',';
}
