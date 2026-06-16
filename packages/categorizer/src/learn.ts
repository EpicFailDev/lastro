import type { CategoryRule } from './types';
import { normalizeText } from './normalize';

const PREFIXES = [
  'pagamento com qr pix',
  'pagamento com codigo qr',
  'pagamento com qr',
  'transferencia enviada pelo pix',
  'transferencia recebida pelo pix',
  'pix enviado',
  'pix recebido',
  'pagamento',
  'compra',
];

const SUFFIXES = ['ltda', 'eireli', 'epp', 'me', 's a', 'sa'];

const LEARNED_WEIGHT = 10;
const KEYWORD_WORDS = 2;

/** Extrai um termo significativo da descrição (sem prefixo/sufixo de ruído). */
function extractKeyword(description: string): string {
  let s = normalizeText(description);
  for (const p of PREFIXES) {
    if (s.startsWith(p)) {
      s = s.slice(p.length).trim();
      break;
    }
  }
  let words = s.split(' ').filter(Boolean);
  while (words.length > 0 && SUFFIXES.includes(words[words.length - 1]!)) {
    words = words.slice(0, -1);
  }
  return words.slice(0, KEYWORD_WORDS).join(' ');
}

/** Gera uma regra `contains` de peso alto a partir de uma correção do usuário. */
export function suggestRuleFromCorrection(description: string, category: string): CategoryRule {
  const pattern = extractKeyword(description);
  if (!pattern) {
    throw new Error(`Não foi possível extrair um termo de: "${description}"`);
  }
  return { matchType: 'contains', pattern, category, weight: LEARNED_WEIGHT };
}
