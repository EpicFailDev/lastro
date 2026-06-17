/** Normaliza a descrição para o hash: minúscula, espaços colapsados. */
function normalize(description: string): string {
  return description.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Hash FNV-1a de 32 bits, em hex. Determinístico e sem dependências. */
function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Gera o hash de deduplicação de uma transação. */
export function makeDedupHash(t: {
  occurredAt: string;
  amountCents: number;
  description: string;
}): string {
  return fnv1a(`${t.occurredAt}|${t.amountCents}|${normalize(t.description)}`);
}

/** Chave de deduplicação lógica: prioriza o identificador externo (FITID/Identificador). */
export function dedupKey(t: { externalId?: string; dedupHash: string }): string {
  return t.externalId ? `ext:${t.externalId}` : `hash:${t.dedupHash}`;
}
