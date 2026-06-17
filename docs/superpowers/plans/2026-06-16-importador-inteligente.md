# Importador inteligente de extrato — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o pacote `@lastro/importers` agnóstico de formato — inferir o layout de um CSV desconhecido por heurísticas determinísticas, importar automaticamente com alta confiança ou devolver um mapeamento proposto para confirmação, e deduplicar por identificador externo (FITID/Identificador).

**Architecture:** Uma camada de análise (`analyzeCsv`) roda antes do motor de parsing puro (`parseCsv`). O motor não muda de filosofia: recebe um layout pronto. A novidade é que o layout passa a ser *resultado* da inferência, não pré-requisito. `detectAndParse` vira orquestrador e retorna um `DetectResult` discriminado (`parsed` | `needs_confirmation`).

**Tech Stack:** TypeScript strict, Vitest, papaparse, zod. Pacote `packages/importers`.

## Global Constraints

- Dinheiro sempre em **centavos inteiros** (`number` int); nunca float. Copiado do design.
- Datas normalizadas para **`YYYY-MM-DD`** (string).
- **Arquivo bruto nunca sai do cliente** — proibido qualquer chamada de rede/ML server-side no parsing.
- TypeScript **strict**; sem `any` implícito.
- Runner de teste: **Vitest** (`pnpm --filter @lastro/importers test`). Testes co-localizados `*.test.ts`.
- Repositório é **público**: nenhum dado bancário real comitado — apenas fixtures anonimizadas.
- `THRESHOLD` de confiança para auto-import: **0.8** (constante nomeada).

---

### Task 1: Dedupe por identificador externo (schema + OFX FITID + CSV idColumn)

**Files:**
- Modify: `packages/importers/src/types.ts`
- Modify: `packages/importers/src/dedup.ts`
- Modify: `packages/importers/src/ofx.ts`
- Modify: `packages/importers/src/csv.ts`
- Test: `packages/importers/src/dedup.test.ts` (existe — adicionar casos), `packages/importers/src/ofx.test.ts`, `packages/importers/src/csv.test.ts`

**Interfaces:**
- Produces:
  - `ParsedTransaction` ganha campo opcional `externalId?: string`.
  - `CsvTemplate` ganha campo opcional `idColumn?: string`.
  - `dedupKey(t: { externalId?: string; dedupHash: string }): string` — retorna `ext:<id>` se houver `externalId`, senão `hash:<dedupHash>`.

- [ ] **Step 1: Escrever o teste que falha (dedupKey)**

Adicionar em `packages/importers/src/dedup.test.ts`:

```ts
import { dedupKey } from './dedup';

describe('dedupKey', () => {
  it('prioriza externalId quando presente', () => {
    expect(dedupKey({ externalId: 'abc-123', dedupHash: 'deadbeef' })).toBe('ext:abc-123');
  });
  it('cai no hash quando não há externalId', () => {
    expect(dedupKey({ dedupHash: 'deadbeef' })).toBe('hash:deadbeef');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @lastro/importers test -- dedup`
Expected: FAIL — `dedupKey is not a function`.

- [ ] **Step 3: Implementar `externalId` no schema + `dedupKey`**

Em `types.ts`, dentro de `parsedTransactionSchema`, adicionar após `dedupHash`:

```ts
  externalId: z.string().min(1).optional(),
```

Em `types.ts`, em `CsvTemplate`, adicionar:

```ts
  idColumn?: string;
```

Em `dedup.ts`, adicionar ao final:

```ts
/** Chave de deduplicação lógica: prioriza o identificador externo (FITID/Identificador). */
export function dedupKey(t: { externalId?: string; dedupHash: string }): string {
  return t.externalId ? `ext:${t.externalId}` : `hash:${t.dedupHash}`;
}
```

- [ ] **Step 4: Escrever testes de extração de externalId (OFX + CSV)**

Em `ofx.test.ts`, adicionar:

```ts
it('extrai FITID como externalId', () => {
  const ofx =
    '<OFX><STMTTRN><DTPOSTED>20260602<TRNAMT>15.00' +
    '<FITID>6a1ed812-0057-447a-ac58-b9bb4ce35866<MEMO>Pix</STMTTRN></OFX>';
  expect(parseOfx(ofx).transactions[0]?.externalId).toBe('6a1ed812-0057-447a-ac58-b9bb4ce35866');
});
```

Em `csv.test.ts`, adicionar (usa um template com idColumn):

```ts
it('extrai a coluna de identificador como externalId', () => {
  const t = { ...template, delimiter: ',', decimalSeparator: '.' as const, idColumn: 'Id' };
  const content = 'Data,Valor,Id,Descrição\n02/06/2026,15.00,uuid-1,Pix\n';
  expect(parseCsv(content, t).transactions[0]?.externalId).toBe('uuid-1');
});
```

- [ ] **Step 5: Implementar extração nos parsers**

Em `ofx.ts`, dentro do `.map`, após obter `description`, adicionar:

```ts
    const externalId = tag(block, 'FITID');
```

e incluir no objeto retornado:

```ts
      externalId,
```

Em `csv.ts`, dentro do `.map`, após `description`, adicionar:

```ts
    const externalId = template.idColumn ? row[template.idColumn]?.trim() || undefined : undefined;
```

e incluir `externalId,` no objeto retornado.

- [ ] **Step 6: Rodar tudo e ver passar**

Run: `pnpm --filter @lastro/importers test`
Expected: PASS (incl. novos casos).

- [ ] **Step 7: Commit**

```bash
git add packages/importers/src/types.ts packages/importers/src/dedup.ts packages/importers/src/dedup.test.ts packages/importers/src/ofx.ts packages/importers/src/ofx.test.ts packages/importers/src/csv.ts packages/importers/src/csv.test.ts
git commit -m "feat(importers): dedupe por externalId (FITID/Identificador)"
```

---

### Task 2: Suporte e detecção de formato de data `dd-mm-yyyy` (Mercado Pago)

**Files:**
- Modify: `packages/importers/src/dates.ts`
- Modify: `packages/importers/src/types.ts` (ampliar união `dateFormat`)
- Create: `packages/importers/src/detect-date.ts`
- Test: `packages/importers/src/dates.test.ts` (existe — adicionar), `packages/importers/src/detect-date.test.ts`

**Interfaces:**
- Consumes: `parseStatementDate` (existente).
- Produces:
  - `parseStatementDate` passa a aceitar `'dd-mm-yyyy'`.
  - `detectDateFormat(samples: string[]): DateFormat | null` — infere o formato a partir de amostras; `null` se inconclusivo.
  - `type DateFormat = 'dd/mm/yyyy' | 'yyyy-mm-dd' | 'dd-mm-yyyy'` exportado de `types.ts`.

- [ ] **Step 1: Teste que falha — parse de `dd-mm-yyyy`**

Em `dates.test.ts`:

```ts
it('parseia dd-mm-yyyy (Mercado Pago)', () => {
  expect(parseStatementDate('02-06-2026', 'dd-mm-yyyy')).toBe('2026-06-02');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @lastro/importers test -- dates`
Expected: FAIL — formato não reconhecido / type error.

- [ ] **Step 3: Implementar `dd-mm-yyyy`**

Em `types.ts`, adicionar e exportar:

```ts
export type DateFormat = 'dd/mm/yyyy' | 'yyyy-mm-dd' | 'dd-mm-yyyy';
```

e trocar o tipo de `dateFormat` em `CsvTemplate` para `DateFormat`.

Em `dates.ts`, trocar a assinatura para usar `DateFormat` e adicionar o ramo `dd-mm-yyyy`:

```ts
import type { DateFormat } from './types';

export function parseStatementDate(raw: string, format: DateFormat): string {
  const s = raw.trim();
  if (format === 'yyyy-mm-dd') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) throw new Error(`Data inválida: "${raw}"`);
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const sep = format === 'dd-mm-yyyy' ? '-' : '/';
  const re = sep === '-' ? /^(\d{1,2})-(\d{1,2})-(\d{4})$/ : /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const m = re.exec(s);
  if (!m) throw new Error(`Data inválida: "${raw}"`);
  const day = m[1]!.padStart(2, '0');
  const month = m[2]!.padStart(2, '0');
  return `${m[3]}-${month}-${day}`;
}
```

- [ ] **Step 4: Teste que falha — `detectDateFormat`**

Em `detect-date.test.ts` (novo):

```ts
import { describe, it, expect } from 'vitest';
import { detectDateFormat } from './detect-date';

describe('detectDateFormat', () => {
  it('reconhece dd/mm/yyyy', () => {
    expect(detectDateFormat(['02/06/2026', '15/06/2026'])).toBe('dd/mm/yyyy');
  });
  it('reconhece yyyy-mm-dd', () => {
    expect(detectDateFormat(['2026-06-02'])).toBe('yyyy-mm-dd');
  });
  it('reconhece dd-mm-yyyy', () => {
    expect(detectDateFormat(['02-06-2026'])).toBe('dd-mm-yyyy');
  });
  it('retorna null se inconclusivo', () => {
    expect(detectDateFormat(['banana', ''])).toBeNull();
  });
});
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `pnpm --filter @lastro/importers test -- detect-date`
Expected: FAIL — módulo inexistente.

- [ ] **Step 6: Implementar `detectDateFormat`**

`detect-date.ts` (novo):

```ts
import type { DateFormat } from './types';

/** Infere o formato de data a partir de amostras. null se inconclusivo. */
export function detectDateFormat(samples: string[]): DateFormat | null {
  const clean = samples.map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) return null;
  const matchesAll = (re: RegExp) => clean.every((s) => re.test(s));
  if (matchesAll(/^\d{4}-\d{2}-\d{2}$/)) return 'yyyy-mm-dd';
  if (matchesAll(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) return 'dd/mm/yyyy';
  if (matchesAll(/^\d{1,2}-\d{1,2}-\d{4}$/)) return 'dd-mm-yyyy';
  return null;
}
```

- [ ] **Step 7: Rodar tudo e ver passar**

Run: `pnpm --filter @lastro/importers test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/importers/src/types.ts packages/importers/src/dates.ts packages/importers/src/dates.test.ts packages/importers/src/detect-date.ts packages/importers/src/detect-date.test.ts
git commit -m "feat(importers): suporta e detecta data dd-mm-yyyy (Mercado Pago)"
```

---

### Task 3: Sniffers de delimitador e separador decimal

**Files:**
- Create: `packages/importers/src/sniff.ts`
- Test: `packages/importers/src/sniff.test.ts`

**Interfaces:**
- Produces:
  - `sniffDelimiter(content: string): string` — escolhe entre `, ; \t |` por consistência de contagem de colunas.
  - `detectDecimalSeparator(samples: string[]): ',' | '.'` — infere a partir de amostras de valor.

- [ ] **Step 1: Testes que falham**

`sniff.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sniffDelimiter, detectDecimalSeparator } from './sniff';

describe('sniffDelimiter', () => {
  it('detecta vírgula', () => {
    expect(sniffDelimiter('Data,Valor,Descrição\n02/06/2026,15.00,Pix\n')).toBe(',');
  });
  it('detecta ponto-e-vírgula', () => {
    expect(sniffDelimiter('Data;Valor;Descrição\n02/06/2026;15,00;Pix\n')).toBe(';');
  });
  it('detecta tab', () => {
    expect(sniffDelimiter('Data\tValor\tDescrição\n02/06/2026\t15.00\tPix\n')).toBe('\t');
  });
});

describe('detectDecimalSeparator', () => {
  it('detecta ponto', () => {
    expect(detectDecimalSeparator(['15.00', '1000.50'])).toBe('.');
  });
  it('detecta vírgula', () => {
    expect(detectDecimalSeparator(['15,00', '1.000,50'])).toBe(',');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @lastro/importers test -- sniff`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

`sniff.ts`:

```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @lastro/importers test -- sniff`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/importers/src/sniff.ts packages/importers/src/sniff.test.ts
git commit -m "feat(importers): sniff de delimitador e separador decimal"
```

---

### Task 4: Mapeamento de colunas por cabeçalho e por conteúdo

**Files:**
- Create: `packages/importers/src/map-columns.ts`
- Test: `packages/importers/src/map-columns.test.ts`

**Interfaces:**
- Consumes: `detectDateFormat` (Task 2).
- Produces:
  - `type ColumnRole = 'date' | 'amount' | 'description' | 'id'`.
  - `type ColumnMapping = { date?: string; amount?: string; description?: string; id?: string; byHeader: Record<ColumnRole, boolean> }`.
  - `mapColumns(headers: string[], rows: string[][]): ColumnMapping` — mapeia papéis por sinônimos de cabeçalho e, no fallback, por conteúdo. `byHeader[role]` indica se o papel veio de cabeçalho (true) ou de conteúdo (false).

- [ ] **Step 1: Testes que falham**

`map-columns.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mapColumns } from './map-columns';

describe('mapColumns', () => {
  it('mapeia por cabeçalho (Nubank-Conta)', () => {
    const m = mapColumns(
      ['Data', 'Valor', 'Identificador', 'Descrição'],
      [['02/06/2026', '15.00', 'uuid-1', 'Pix recebido']],
    );
    expect(m.date).toBe('Data');
    expect(m.amount).toBe('Valor');
    expect(m.id).toBe('Identificador');
    expect(m.description).toBe('Descrição');
    expect(m.byHeader.date).toBe(true);
  });

  it('mapeia por conteúdo quando cabeçalho é genérico', () => {
    const m = mapColumns(
      ['col1', 'col2', 'col3'],
      [
        ['02/06/2026', '15.00', 'Mercado'],
        ['03/06/2026', '-9.90', 'Spotify'],
      ],
    );
    expect(m.date).toBe('col1');
    expect(m.amount).toBe('col2');
    expect(m.description).toBe('col3');
    expect(m.byHeader.date).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @lastro/importers test -- map-columns`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

`map-columns.ts`:

```ts
import { detectDateFormat } from './detect-date';

export type ColumnRole = 'date' | 'amount' | 'description' | 'id';
export type ColumnMapping = {
  date?: string;
  amount?: string;
  description?: string;
  id?: string;
  byHeader: Record<ColumnRole, boolean>;
};

const SYNONYMS: Record<ColumnRole, string[]> = {
  date: ['data', 'date', 'posted', 'data da compra', 'data do lancamento'],
  amount: ['valor', 'amount', 'montante', 'quantia', 'value'],
  description: [
    'descricao', 'description', 'title', 'historico', 'memo', 'lancamento', 'estabelecimento',
  ],
  id: ['identificador', 'id', 'fitid', 'id da operacao', 'transaction id'],
};

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const looksMoney = (v: string) => /^-?\s*[\d.,]+$/.test(v.trim()) && /\d/.test(v);
const looksId = (v: string) => /^[0-9a-f-]{12,}$/i.test(v.trim()) || /^\d{8,}$/.test(v.trim());

export function mapColumns(headers: string[], rows: string[][]): ColumnMapping {
  const byHeader: Record<ColumnRole, boolean> = {
    date: false, amount: false, description: false, id: false,
  };
  const result: ColumnMapping = { byHeader };
  const used = new Set<number>();

  // 1) por sinônimo de cabeçalho
  for (const role of Object.keys(SYNONYMS) as ColumnRole[]) {
    const idx = headers.findIndex((h, i) => !used.has(i) && SYNONYMS[role].includes(norm(h)));
    if (idx >= 0) {
      result[role] = headers[idx];
      byHeader[role] = true;
      used.add(idx);
    }
  }

  // 2) fallback por conteúdo (date, amount, id) e description = maior texto restante
  const colValues = (i: number) => rows.map((r) => r[i] ?? '').filter(Boolean);
  if (!result.date) {
    const idx = headers.findIndex(
      (_, i) => !used.has(i) && detectDateFormat(colValues(i).slice(0, 5)) !== null,
    );
    if (idx >= 0) { result.date = headers[idx]; used.add(idx); }
  }
  if (!result.amount) {
    const idx = headers.findIndex(
      (_, i) => !used.has(i) && colValues(i).slice(0, 5).every(looksMoney),
    );
    if (idx >= 0) { result.amount = headers[idx]; used.add(idx); }
  }
  if (!result.id) {
    const idx = headers.findIndex(
      (_, i) => !used.has(i) && colValues(i).slice(0, 5).every(looksId),
    );
    if (idx >= 0) { result.id = headers[idx]; used.add(idx); }
  }
  if (!result.description) {
    let bestIdx = -1;
    let bestLen = -1;
    headers.forEach((_, i) => {
      if (used.has(i)) return;
      const avg = colValues(i).reduce((a, v) => a + v.length, 0) / (colValues(i).length || 1);
      if (avg > bestLen) { bestLen = avg; bestIdx = i; }
    });
    if (bestIdx >= 0) { result.description = headers[bestIdx]; used.add(bestIdx); }
  }

  return result;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @lastro/importers test -- map-columns`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/importers/src/map-columns.ts packages/importers/src/map-columns.test.ts
git commit -m "feat(importers): mapeamento de colunas por cabecalho e conteudo"
```

---

### Task 5: Detecção de sinal (signed vs invertSign)

**Files:**
- Create: `packages/importers/src/detect-sign.ts`
- Test: `packages/importers/src/detect-sign.test.ts`

**Interfaces:**
- Produces:
  - `type SignResult = { invertSign: boolean; confident: boolean; reason: string }`.
  - `detectSign(amountSamples: string[]): SignResult` — confia no sinal se há positivos e negativos; marca `invertSign` se tudo positivo (heurística de fatura) mas com `confident: false` (ambíguo → confirmação).

- [ ] **Step 1: Testes que falham**

`detect-sign.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { detectSign } from './detect-sign';

describe('detectSign', () => {
  it('confia no sinal quando há positivos e negativos', () => {
    const r = detectSign(['15.00', '-9.90', '100.00']);
    expect(r.invertSign).toBe(false);
    expect(r.confident).toBe(true);
  });
  it('marca ambíguo quando tudo positivo', () => {
    const r = detectSign(['15.00', '9.90', '100.00']);
    expect(r.confident).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @lastro/importers test -- detect-sign`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

`detect-sign.ts`:

```ts
export type SignResult = { invertSign: boolean; confident: boolean; reason: string };

/** Decide convenção de sinal a partir de amostras de valor. */
export function detectSign(amountSamples: string[]): SignResult {
  const hasNegative = amountSamples.some((s) => s.includes('-') || /^\(.*\)$/.test(s.trim()));
  if (hasNegative) {
    return { invertSign: false, confident: true, reason: 'coluna tem positivos e negativos' };
  }
  return {
    invertSign: false,
    confident: false,
    reason: 'tudo positivo: convenção de sinal ambígua (precisa confirmação)',
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @lastro/importers test -- detect-sign`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/importers/src/detect-sign.ts packages/importers/src/detect-sign.test.ts
git commit -m "feat(importers): deteccao de convencao de sinal"
```

---

### Task 6: `analyzeCsv` — orquestrador que produz CsvLayout + confiança

**Files:**
- Create: `packages/importers/src/analyze-csv.ts`
- Modify: `packages/importers/src/types.ts` (adicionar `CsvLayout`)
- Test: `packages/importers/src/analyze-csv.test.ts`

**Interfaces:**
- Consumes: `sniffDelimiter`, `detectDecimalSeparator` (Task 3); `detectDateFormat` (Task 2); `mapColumns` (Task 4); `detectSign` (Task 5).
- Produces:
  - `type CsvLayout` (em `types.ts`) com `delimiter, hasHeader, dateColumn, amountColumn, descriptionColumn, idColumn?, dateFormat, decimalSeparator, invertSign?, confidence, signals[]`.
  - `analyzeCsv(content: string): CsvLayout`.

- [ ] **Step 1: Adicionar o tipo `CsvLayout` em `types.ts`**

```ts
import type { DateFormat } from './types'; // já no arquivo; manter coeso

export type CsvLayout = {
  name?: string;
  delimiter: string;
  hasHeader: boolean;
  dateColumn: string;
  amountColumn: string;
  descriptionColumn: string;
  idColumn?: string;
  dateFormat: DateFormat;
  decimalSeparator: ',' | '.';
  invertSign?: boolean;
  confidence: number;
  signals: string[];
};
```

(Não precisa de import extra — `DateFormat` está no mesmo arquivo.)

- [ ] **Step 2: Teste que falha**

`analyze-csv.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { analyzeCsv } from './analyze-csv';

describe('analyzeCsv', () => {
  it('infere o layout do Nubank-Conta real com alta confiança', () => {
    const content =
      'Data,Valor,Identificador,Descrição\n' +
      '02/06/2026,15.00,6a1ed812-0057-447a-ac58-b9bb4ce35866,Pix recebido\n' +
      '03/06/2026,-9.90,7b2fe923-1168-558b-bd69-c0cc5df46977,Spotify\n';
    const layout = analyzeCsv(content);
    expect(layout.delimiter).toBe(',');
    expect(layout.decimalSeparator).toBe('.');
    expect(layout.dateFormat).toBe('dd/mm/yyyy');
    expect(layout.dateColumn).toBe('Data');
    expect(layout.amountColumn).toBe('Valor');
    expect(layout.idColumn).toBe('Identificador');
    expect(layout.descriptionColumn).toBe('Descrição');
    expect(layout.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('baixa a confiança quando o sinal é ambíguo (fatura tudo-positiva)', () => {
    const content = 'date,amount,title\n2026-06-02,15.00,Mercado\n2026-06-03,9.90,Uber\n';
    const layout = analyzeCsv(content);
    expect(layout.confidence).toBeLessThan(0.8);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter @lastro/importers test -- analyze-csv`
Expected: FAIL — módulo inexistente.

- [ ] **Step 4: Implementar**

`analyze-csv.ts`:

```ts
import Papa from 'papaparse';
import type { CsvLayout } from './types';
import { sniffDelimiter, detectDecimalSeparator } from './sniff';
import { detectDateFormat } from './detect-date';
import { mapColumns } from './map-columns';
import { detectSign } from './detect-sign';

export function analyzeCsv(content: string): CsvLayout {
  const signals: string[] = [];
  const delimiter = sniffDelimiter(content);
  signals.push(`delimitador "${delimiter}" por consistência`);

  const parsed = Papa.parse<string[]>(content.trim(), { delimiter, skipEmptyLines: true });
  const matrix = parsed.data;
  const headers = matrix[0] ?? [];
  const dataRows = matrix.slice(1);

  const mapping = mapColumns(headers, dataRows);
  if (!mapping.date || !mapping.amount || !mapping.description) {
    throw new Error('Não foi possível identificar colunas essenciais (data/valor/descrição).');
  }

  const colIndex = (name: string) => headers.indexOf(name);
  const sampleOf = (name: string) =>
    dataRows.map((r) => r[colIndex(name)] ?? '').filter(Boolean);

  const dateFormat = detectDateFormat(sampleOf(mapping.date)) ?? 'dd/mm/yyyy';
  const decimalSeparator = detectDecimalSeparator(sampleOf(mapping.amount));
  const sign = detectSign(sampleOf(mapping.amount));
  signals.push(sign.reason);

  // Confiança: começa em 1, penaliza papéis adivinhados por conteúdo e sinal ambíguo.
  let confidence = 1;
  (['date', 'amount', 'description'] as const).forEach((role) => {
    if (!mapping.byHeader[role]) {
      confidence -= 0.2;
      signals.push(`coluna ${role} inferida por conteúdo`);
    } else {
      signals.push(`coluna ${role} por cabeçalho`);
    }
  });
  if (!sign.confident) confidence -= 0.3;

  return {
    delimiter,
    hasHeader: true,
    dateColumn: mapping.date,
    amountColumn: mapping.amount,
    descriptionColumn: mapping.description,
    idColumn: mapping.id,
    dateFormat,
    decimalSeparator,
    invertSign: sign.invertSign,
    confidence: Math.max(0, Math.min(1, confidence)),
    signals,
  };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter @lastro/importers test -- analyze-csv`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/importers/src/analyze-csv.ts packages/importers/src/analyze-csv.test.ts packages/importers/src/types.ts
git commit -m "feat(importers): analyzeCsv infere layout com confianca e sinais"
```

---

### Task 7: `detectAndParse` retorna `DetectResult` (parsed | needs_confirmation)

**Files:**
- Modify: `packages/importers/src/detect.ts`
- Modify: `packages/importers/src/types.ts` (adicionar `DetectResult`)
- Modify: `packages/importers/src/detect.test.ts` (API mudou — atualizar)

**Interfaces:**
- Consumes: `analyzeCsv` (Task 6); `parseOfx`, `parseCsv`; `CsvLayout`, `ImportResult`.
- Produces:
  - `type DetectResult = { status: 'parsed'; result: ImportResult; layout?: CsvLayout } | { status: 'needs_confirmation'; layout: CsvLayout; headers?: string[]; sampleRows: string[][] }`.
  - `detectAndParse(content: string, opts?: { csvTemplate?: CsvTemplate }): DetectResult`.
  - `CONFIDENCE_THRESHOLD = 0.8` exportado.

- [ ] **Step 1: Adicionar `DetectResult` em `types.ts`**

```ts
export type DetectResult =
  | { status: 'parsed'; result: ImportResult; layout?: CsvLayout }
  | { status: 'needs_confirmation'; layout: CsvLayout; headers?: string[]; sampleRows: string[][] };
```

- [ ] **Step 2: Atualizar `detect.test.ts` (API nova) — testes que falham**

Substituir o conteúdo de `detect.test.ts` por:

```ts
import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';
import { detectAndParse } from './detect';

describe('detectAndParse', () => {
  it('OFX → status parsed', () => {
    const ofx = '<OFX><STMTTRN><DTPOSTED>20260205<TRNAMT>-15.00<MEMO>iFood</STMTTRN></OFX>';
    const r = detectAndParse(ofx);
    expect(r.status).toBe('parsed');
    if (r.status === 'parsed') expect(r.result.format).toBe('ofx');
  });

  it('CSV de alta confiança → parsed sem precisar de template', () => {
    const csv =
      'Data,Valor,Identificador,Descrição\n02/06/2026,-9.90,uuid-1,Spotify\n03/06/2026,15.00,uuid-2,Pix\n';
    const r = detectAndParse(csv);
    expect(r.status).toBe('parsed');
    if (r.status === 'parsed') {
      expect(r.result.transactions[0]?.amountCents).toBe(-990);
      expect(r.result.transactions[0]?.externalId).toBe('uuid-1');
    }
  });

  it('CSV ambíguo → needs_confirmation com layout proposto', () => {
    const csv = 'date,amount,title\n2026-06-02,15.00,Mercado\n2026-06-03,9.90,Uber\n';
    const r = detectAndParse(csv);
    expect(r.status).toBe('needs_confirmation');
    if (r.status === 'needs_confirmation') {
      expect(r.layout.amountColumn).toBe('amount');
      expect(r.sampleRows.length).toBeGreaterThan(0);
    }
  });

  it('respeita csvTemplate explícito', () => {
    const csv = 'Data;Valor;Descrição\n05/02/2026;-15,00;iFood\n';
    const r = detectAndParse(csv, {
      csvTemplate: {
        name: 't', delimiter: ';', dateColumn: 'Data', amountColumn: 'Valor',
        descriptionColumn: 'Descrição', dateFormat: 'dd/mm/yyyy', decimalSeparator: ',',
      },
    });
    expect(r.status).toBe('parsed');
  });
});

// silencia eslint de import não usado se Papa não for necessário no teste final
void Papa;
```

(Se `Papa` não for usado, remova a linha de import e o `void Papa;`.)

- [ ] **Step 3: Rodar e ver falhar**

Run: `pnpm --filter @lastro/importers test -- detect`
Expected: FAIL — `status` inexistente / tipo antigo.

- [ ] **Step 4: Reescrever `detect.ts`**

```ts
import Papa from 'papaparse';
import type { CsvTemplate, DetectResult } from './types';
import { parseCsv } from './csv';
import { parseOfx } from './ofx';
import { analyzeCsv } from './analyze-csv';

export const CONFIDENCE_THRESHOLD = 0.8;

function looksLikeOfx(content: string): boolean {
  const head = content.slice(0, 512).toUpperCase();
  return head.includes('OFXHEADER') || head.includes('<OFX>');
}

/** Detecta o formato e delega; para CSV, infere o layout e decide auto-import vs confirmação. */
export function detectAndParse(
  content: string,
  opts: { csvTemplate?: CsvTemplate } = {},
): DetectResult {
  if (looksLikeOfx(content)) {
    return { status: 'parsed', result: parseOfx(content) };
  }
  if (opts.csvTemplate) {
    return { status: 'parsed', result: parseCsv(content, opts.csvTemplate) };
  }

  const layout = analyzeCsv(content);
  if (layout.confidence >= CONFIDENCE_THRESHOLD) {
    return { status: 'parsed', result: parseCsv(content, layout), layout };
  }

  const parsed = Papa.parse<string[]>(content.trim(), {
    delimiter: layout.delimiter,
    skipEmptyLines: true,
  });
  const matrix = parsed.data;
  return {
    status: 'needs_confirmation',
    layout,
    headers: matrix[0],
    sampleRows: matrix.slice(1, 6),
  };
}
```

Observação: `parseCsv` aceita `CsvLayout` porque ele lê apenas os campos compartilhados com `CsvTemplate` (`delimiter, dateColumn, amountColumn, descriptionColumn, idColumn, dateFormat, decimalSeparator, invertSign`). Garanta em `csv.ts` que o parâmetro aceite `CsvTemplate | CsvLayout` — ajuste a assinatura para `template: CsvTemplate | CsvLayout`.

- [ ] **Step 5: Ajustar a assinatura de `parseCsv`**

Em `csv.ts`, trocar o tipo do parâmetro:

```ts
import type { CsvTemplate, CsvLayout, ImportResult, ParsedTransaction } from './types';

export function parseCsv(content: string, template: CsvTemplate | CsvLayout): ImportResult {
```

- [ ] **Step 6: Rodar tudo e ver passar**

Run: `pnpm --filter @lastro/importers test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/importers/src/detect.ts packages/importers/src/detect.test.ts packages/importers/src/types.ts packages/importers/src/csv.ts
git commit -m "feat(importers): detectAndParse retorna DetectResult (parsed|needs_confirmation)"
```

---

### Task 8: Recalibrar template do Nubank + reconhecimento por assinatura

**Files:**
- Modify: `packages/importers/src/templates.ts`
- Modify: `packages/importers/src/analyze-csv.ts` (reconhecer assinatura conhecida → `name` + confiança)
- Test: `packages/importers/src/templates.test.ts`

**Interfaces:**
- Consumes: `CsvLayout`.
- Produces:
  - `nubankAccountTemplate` recalibrado (delimiter `,`, decimal `.`, `idColumn: 'Identificador'`).
  - `matchKnownBank(headers: string[]): string | undefined` — retorna nome amigável se a assinatura de cabeçalho casar.

- [ ] **Step 1: Teste que falha**

`templates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { nubankAccountTemplate, matchKnownBank } from './templates';

describe('templates', () => {
  it('Nubank-Conta calibrado com o export real', () => {
    expect(nubankAccountTemplate.delimiter).toBe(',');
    expect(nubankAccountTemplate.decimalSeparator).toBe('.');
    expect(nubankAccountTemplate.idColumn).toBe('Identificador');
  });

  it('reconhece a assinatura do Nubank-Conta', () => {
    expect(matchKnownBank(['Data', 'Valor', 'Identificador', 'Descrição'])).toBe('Nubank — Conta');
  });

  it('retorna undefined para assinatura desconhecida', () => {
    expect(matchKnownBank(['col1', 'col2'])).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @lastro/importers test -- templates`
Expected: FAIL — `matchKnownBank` inexistente / valores antigos.

- [ ] **Step 3: Recalibrar `nubankAccountTemplate` e adicionar `matchKnownBank`**

Em `templates.ts`, substituir `nubankAccountTemplate` por:

```ts
// Extrato da conta Nubank (export real): "Data,Valor,Identificador,Descrição" (DD/MM/YYYY, ponto decimal).
export const nubankAccountTemplate: CsvTemplate = {
  name: 'Nubank — Conta',
  delimiter: ',',
  dateColumn: 'Data',
  amountColumn: 'Valor',
  descriptionColumn: 'Descrição',
  idColumn: 'Identificador',
  dateFormat: 'dd/mm/yyyy',
  decimalSeparator: '.',
};
```

e adicionar ao final:

```ts
/** Assinaturas de cabeçalho conhecidas → nome amigável do banco. */
const SIGNATURES: { name: string; headers: string[] }[] = [
  { name: 'Nubank — Conta', headers: ['Data', 'Valor', 'Identificador', 'Descrição'] },
];

export function matchKnownBank(headers: string[]): string | undefined {
  const key = headers.map((h) => h.trim()).join('|');
  return SIGNATURES.find((s) => s.headers.join('|') === key)?.name;
}
```

- [ ] **Step 4: Usar `matchKnownBank` em `analyzeCsv` para nome + bônus de confiança**

Em `analyze-csv.ts`, importar e aplicar antes do `return`:

```ts
import { matchKnownBank } from './templates';
```

e, logo após calcular `confidence`:

```ts
  const knownBank = matchKnownBank(headers);
  if (knownBank) {
    confidence = 1;
    signals.push(`assinatura reconhecida: ${knownBank}`);
  }
```

incluindo `name: knownBank,` no objeto retornado.

- [ ] **Step 5: Rodar tudo e ver passar**

Run: `pnpm --filter @lastro/importers test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/importers/src/templates.ts packages/importers/src/templates.test.ts packages/importers/src/analyze-csv.ts
git commit -m "feat(importers): recalibra Nubank-Conta e reconhece banco por assinatura"
```

---

### Task 9: Fixtures anonimizadas + testes golden (regressão real + dedup cruzado)

**Files:**
- Create: `packages/importers/src/__fixtures__/nubank-conta.csv`
- Create: `packages/importers/src/__fixtures__/nubank-conta.ofx`
- Create: `packages/importers/src/golden.test.ts`
- Modify: `packages/importers/src/index.ts` (exportar nova API pública)

**Interfaces:**
- Consumes: `detectAndParse`, `dedupKey`, `analyzeCsv`, `matchKnownBank`, `CsvLayout`, `DetectResult`.

- [ ] **Step 1: Criar fixtures ANONIMIZADAS (dados falsos, estrutura real)**

`__fixtures__/nubank-conta.csv` (note: mesmo UUID do OFX para testar dedup cruzado):

```
Data,Valor,Identificador,Descrição
02/06/2026,15.00,6a1ed812-0000-0000-0000-000000000001,Transferência recebida pelo Pix - FULANO DE TAL
03/06/2026,-9.90,6a1ed812-0000-0000-0000-000000000002,Spotify
```

`__fixtures__/nubank-conta.ofx`:

```
OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260602000000[-3:BRT]<TRNAMT>15.00<FITID>6a1ed812-0000-0000-0000-000000000001<MEMO>Transferencia recebida pelo Pix - FULANO DE TAL</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260603000000[-3:BRT]<TRNAMT>-9.90<FITID>6a1ed812-0000-0000-0000-000000000002<MEMO>Spotify</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>
```

- [ ] **Step 2: Teste golden que falha**

`golden.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectAndParse } from './detect';
import { dedupKey } from './dedup';
import type { ParsedTransaction } from './types';

const read = (f: string) => readFileSync(join(__dirname, '__fixtures__', f), 'utf8');

describe('golden — Nubank-Conta real (anonimizado)', () => {
  it('CSV real importa automaticamente (regressão do bug do template)', () => {
    const r = detectAndParse(read('nubank-conta.csv'));
    expect(r.status).toBe('parsed');
    if (r.status === 'parsed') {
      expect(r.result.transactions[0]?.amountCents).toBe(1500);
      expect(r.result.transactions[1]?.amountCents).toBe(-990);
    }
  });

  it('mesmo período em OFX e CSV não duplica (dedup por externalId)', () => {
    const csv = detectAndParse(read('nubank-conta.csv'));
    const ofx = detectAndParse(read('nubank-conta.ofx'));
    expect(csv.status === 'parsed' && ofx.status === 'parsed').toBe(true);
    if (csv.status !== 'parsed' || ofx.status !== 'parsed') return;
    const all: ParsedTransaction[] = [...csv.result.transactions, ...ofx.result.transactions];
    const unique = new Set(all.map(dedupKey));
    expect(unique.size).toBe(2);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar (depois passar sem mudar código)**

Run: `pnpm --filter @lastro/importers test -- golden`
Expected: inicialmente FAIL se algo da cadeia estiver incompleto; após Tasks 1–8, PASS. Se falhar, corrigir a causa apontada — não relaxar o teste.

- [ ] **Step 4: Exportar a API pública nova em `index.ts`**

Adicionar a `index.ts`:

```ts
export type { CsvLayout, DetectResult, DateFormat } from './types';
export { dedupKey } from './dedup';
export { analyzeCsv } from './analyze-csv';
export { detectDateFormat } from './detect-date';
export { matchKnownBank } from './templates';
export { CONFIDENCE_THRESHOLD } from './detect';
```

- [ ] **Step 5: Rodar a suíte inteira + typecheck + lint**

Run: `pnpm --filter @lastro/importers test && pnpm --filter @lastro/importers typecheck && pnpm --filter @lastro/importers lint`
Expected: tudo PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/importers/src/__fixtures__ packages/importers/src/golden.test.ts packages/importers/src/index.ts
git commit -m "test(importers): fixtures anonimizadas + golden (regressao real + dedup cruzado)"
```

---

## Self-Review

**Spec coverage:**
- Arquitetura (camada analyzeCsv antes do motor) → Tasks 6–7. ✓
- Dedupe por externalId (FITID/Identificador) → Task 1. ✓
- Detecção: delimitador/decimal → Task 3; data (incl. dd-mm-yyyy) → Task 2; colunas → Task 4; sinal → Task 5; confiança+sinais → Task 6. ✓
- Contrato DetectResult (parsed|needs_confirmation) → Task 7. ✓
- Templates como atalho + assinatura → Task 8. ✓
- Testes e privacidade (fixtures anonimizadas, golden, dedup cruzado, regressão do bug) → Task 9. ✓
- Fora de escopo (UI/ML/PDF) — não há tasks, correto.

**Placeholder scan:** sem TBD/TODO; todo passo tem código real.

**Type consistency:** `CsvLayout`/`DetectResult`/`DateFormat` definidos em `types.ts` e consumidos consistentemente; `parseCsv` aceita `CsvTemplate | CsvLayout`; `mapColumns`→`ColumnMapping`; `detectSign`→`SignResult`. Nomes batem entre tasks.

**Risco conhecido:** a confiança em Task 6 usa pesos fixos (−0.2 por papel inferido, −0.3 sinal ambíguo). O teste de Task 6/7 valida os limiares; se a calibração precisar de ajuste, alterar só as constantes em `analyze-csv.ts`.
