# Pacote `importers` (OFX/CSV) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o pacote `@lastro/importers` — lógica pura (sem UI/nuvem) que lê extratos bancários (CSV de Nubank/Mercado Pago + genérico, e OFX) e devolve transações normalizadas, com hash de deduplicação, 100% coberto por testes.

**Architecture:** Pacote isolado em `packages/importers`. Tipos definidos com Zod. Utilitários puros (parse de valor monetário, parse de data, hash de dedup). Parser de CSV sobre PapaParse, dirigido por "templates" declarativos (um por banco) + um template genérico. Parser de OFX próprio (sem dependência), focado nos blocos `STMTTRN`. Um dispatcher `detectAndParse` escolhe o parser pelo conteúdo. Sem efeitos colaterais: entra string, sai dado.

**Tech Stack:** TypeScript, Zod, PapaParse, Vitest.

**Pré-requisitos:** `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm"` para o pnpm.

---

## Estrutura de arquivos (criada por este plano)

```
lastro/
├── .gitignore                       # + .turbo (follow-up pendente)
├── packages/importers/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                 # API pública
│       ├── types.ts                 # schemas Zod + tipos
│       ├── money.ts                 # parseAmountToCents
│       ├── money.test.ts
│       ├── dates.ts                 # parseStatementDate
│       ├── dates.test.ts
│       ├── dedup.ts                 # makeDedupHash (FNV-1a)
│       ├── dedup.test.ts
│       ├── csv.ts                   # parseCsv(content, template)
│       ├── csv.test.ts
│       ├── ofx.ts                   # parseOfx(content)
│       ├── ofx.test.ts
│       ├── templates.ts             # nubank / mercadoPago / genérico
│       ├── detect.ts                # detectAndParse(content, opts)
│       └── detect.test.ts
```

### Contratos centrais

```ts
// Uma transação normalizada extraída de um extrato.
type ParsedTransaction = {
  occurredAt: string;     // 'YYYY-MM-DD'
  amountCents: number;    // inteiro; negativo = despesa, positivo = receita
  description: string;
  dedupHash: string;
};

// Resultado de um import.
type ImportResult = {
  format: 'csv' | 'ofx';
  transactions: ParsedTransaction[];
  rowCount: number;
};

// Template declarativo de CSV (um por banco).
type CsvTemplate = {
  name: string;
  delimiter?: string;            // padrão ','
  dateColumn: string;
  amountColumn: string;
  descriptionColumn: string;
  dateFormat: 'dd/mm/yyyy' | 'yyyy-mm-dd';
  decimalSeparator: ',' | '.';
  invertSign?: boolean;          // true quando o banco lista despesas como positivas
};
```

---

### Task 1: Scaffold do pacote + fix do `.turbo`

**Files:**
- Modify: `.gitignore`
- Create: `packages/importers/package.json`
- Create: `packages/importers/tsconfig.json`
- Create: `packages/importers/src/index.ts`

- [ ] **Step 1: Ignorar `.turbo` (follow-up pendente do Plano 1)**

Adicione ao fim de `.gitignore`:

```
# Cache do Turborepo
.turbo/
```

- [ ] **Step 2: package.json do pacote**

`packages/importers/package.json`:

```json
{
  "name": "@lastro/importers",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint src",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "papaparse": "^5.4.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/papaparse": "^5.3.14"
  }
}
```

- [ ] **Step 3: tsconfig do pacote**

`packages/importers/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 4: index temporário (será preenchido)**

`packages/importers/src/index.ts`:

```ts
export {};
```

- [ ] **Step 5: Instalar dependências**

Run: `pnpm install`
Expected: instala papaparse, zod, @types/papaparse no pacote.

- [ ] **Step 6: Commit**

```bash
git add .gitignore packages/importers pnpm-lock.yaml
git commit -m "chore(importers): scaffold do pacote + ignora .turbo"
```

---

### Task 2: Tipos com Zod

**Files:**
- Create: `packages/importers/src/types.ts`

- [ ] **Step 1: Definir schemas e tipos**

`packages/importers/src/types.ts`:

```ts
import { z } from 'zod';

export const parsedTransactionSchema = z.object({
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data deve ser YYYY-MM-DD'),
  amountCents: z.number().int(),
  description: z.string(),
  dedupHash: z.string().min(1),
});
export type ParsedTransaction = z.infer<typeof parsedTransactionSchema>;

export const importResultSchema = z.object({
  format: z.enum(['csv', 'ofx']),
  transactions: z.array(parsedTransactionSchema),
  rowCount: z.number().int().nonnegative(),
});
export type ImportResult = z.infer<typeof importResultSchema>;

export type CsvTemplate = {
  name: string;
  delimiter?: string;
  dateColumn: string;
  amountColumn: string;
  descriptionColumn: string;
  dateFormat: 'dd/mm/yyyy' | 'yyyy-mm-dd';
  decimalSeparator: ',' | '.';
  invertSign?: boolean;
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @lastro/importers typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/importers/src/types.ts
git commit -m "feat(importers): tipos normalizados com zod"
```

---

### Task 3: `parseAmountToCents` (TDD)

**Files:**
- Create: `packages/importers/src/money.test.ts`
- Create: `packages/importers/src/money.ts`

- [ ] **Step 1: Teste que falha**

`packages/importers/src/money.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseAmountToCents } from './money';

describe('parseAmountToCents', () => {
  it('valor BR com vírgula decimal', () => {
    expect(parseAmountToCents('1.234,56', ',')).toBe(123456);
  });
  it('valor com símbolo e espaços', () => {
    expect(parseAmountToCents('R$ 12,34', ',')).toBe(1234);
  });
  it('negativo explícito', () => {
    expect(parseAmountToCents('-5,00', ',')).toBe(-500);
  });
  it('parênteses significam negativo', () => {
    expect(parseAmountToCents('(7,50)', ',')).toBe(-750);
  });
  it('ponto decimal (en-US)', () => {
    expect(parseAmountToCents('1234.56', '.')).toBe(123456);
  });
  it('arredonda meio centavo', () => {
    expect(parseAmountToCents('0,005', ',')).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @lastro/importers test`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

`packages/importers/src/money.ts`:

```ts
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
  s = s.replace(new RegExp(`[^0-9${decimalSeparator === '.' ? '\\.' : decimalSeparator}]`, 'g'), '');
  s = s.replace(decimalSeparator, '.');

  const value = Number(s);
  if (Number.isNaN(value)) {
    throw new Error(`Valor monetário inválido: "${raw}"`);
  }
  const cents = Math.round(value * 100);
  return negative ? -cents : cents;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @lastro/importers test`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add packages/importers/src/money.ts packages/importers/src/money.test.ts
git commit -m "feat(importers): parseAmountToCents com testes"
```

---

### Task 4: `parseStatementDate` (TDD)

**Files:**
- Create: `packages/importers/src/dates.test.ts`
- Create: `packages/importers/src/dates.ts`

- [ ] **Step 1: Teste que falha**

`packages/importers/src/dates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseStatementDate } from './dates';

describe('parseStatementDate', () => {
  it('dd/mm/yyyy', () => {
    expect(parseStatementDate('05/02/2026', 'dd/mm/yyyy')).toBe('2026-02-05');
  });
  it('yyyy-mm-dd (passa direto)', () => {
    expect(parseStatementDate('2026-02-05', 'yyyy-mm-dd')).toBe('2026-02-05');
  });
  it('dd/mm/yyyy com dia/mês de 1 dígito', () => {
    expect(parseStatementDate('5/2/2026', 'dd/mm/yyyy')).toBe('2026-02-05');
  });
  it('data inválida lança erro', () => {
    expect(() => parseStatementDate('xx/yy/zzzz', 'dd/mm/yyyy')).toThrow();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @lastro/importers test`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`packages/importers/src/dates.ts`:

```ts
/** Converte uma data de extrato para 'YYYY-MM-DD'. */
export function parseStatementDate(
  raw: string,
  format: 'dd/mm/yyyy' | 'yyyy-mm-dd',
): string {
  const s = raw.trim();
  if (format === 'yyyy-mm-dd') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) throw new Error(`Data inválida: "${raw}"`);
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) throw new Error(`Data inválida: "${raw}"`);
  const day = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  return `${m[3]}-${month}-${day}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @lastro/importers test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/importers/src/dates.ts packages/importers/src/dates.test.ts
git commit -m "feat(importers): parseStatementDate com testes"
```

---

### Task 5: `makeDedupHash` (TDD)

**Files:**
- Create: `packages/importers/src/dedup.test.ts`
- Create: `packages/importers/src/dedup.ts`

- [ ] **Step 1: Teste que falha**

`packages/importers/src/dedup.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeDedupHash } from './dedup';

describe('makeDedupHash', () => {
  const base = { occurredAt: '2026-02-05', amountCents: -1500, description: 'iFood' };

  it('é determinístico', () => {
    expect(makeDedupHash(base)).toBe(makeDedupHash(base));
  });
  it('ignora caixa/espaços na descrição', () => {
    expect(makeDedupHash(base)).toBe(
      makeDedupHash({ ...base, description: '  IFOOD  ' }),
    );
  });
  it('muda se o valor muda', () => {
    expect(makeDedupHash(base)).not.toBe(makeDedupHash({ ...base, amountCents: -1600 }));
  });
  it('muda se a data muda', () => {
    expect(makeDedupHash(base)).not.toBe(makeDedupHash({ ...base, occurredAt: '2026-02-06' }));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @lastro/importers test`
Expected: FAIL.

- [ ] **Step 3: Implementar (FNV-1a 32-bit, determinístico e sem deps)**

`packages/importers/src/dedup.ts`:

```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @lastro/importers test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/importers/src/dedup.ts packages/importers/src/dedup.test.ts
git commit -m "feat(importers): makeDedupHash (FNV-1a) com testes"
```

---

### Task 6: `parseCsv` dirigido por template (TDD)

**Files:**
- Create: `packages/importers/src/csv.test.ts`
- Create: `packages/importers/src/csv.ts`

- [ ] **Step 1: Teste que falha**

`packages/importers/src/csv.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseCsv } from './csv';
import type { CsvTemplate } from './types';

const template: CsvTemplate = {
  name: 'teste',
  dateColumn: 'Data',
  amountColumn: 'Valor',
  descriptionColumn: 'Descrição',
  dateFormat: 'dd/mm/yyyy',
  decimalSeparator: ',',
};

describe('parseCsv', () => {
  it('extrai transações normalizadas', () => {
    const content =
      'Data,Valor,Descrição\n' +
      '05/02/2026,-15,00,iFood\n' +
      '06/02/2026,1.000,00,Salário\n';
    const result = parseCsv(content, template);
    expect(result.format).toBe('csv');
    expect(result.rowCount).toBe(2);
    expect(result.transactions[0]).toMatchObject({
      occurredAt: '2026-02-05',
      amountCents: -1500,
      description: 'iFood',
    });
    expect(result.transactions[1]?.amountCents).toBe(100000);
    expect(result.transactions[0]?.dedupHash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('invertSign transforma despesa positiva em negativa', () => {
    const t = { ...template, invertSign: true };
    const content = 'Data,Valor,Descrição\n05/02/2026,15,00,Compra\n';
    expect(parseCsv(content, t).transactions[0]?.amountCents).toBe(-1500);
  });

  it('ignora linhas em branco', () => {
    const content = 'Data,Valor,Descrição\n05/02/2026,-1,00,A\n\n';
    expect(parseCsv(content, template).rowCount).toBe(1);
  });

  it('lança erro se faltar coluna mapeada', () => {
    const content = 'Data,Outra,Descrição\n05/02/2026,-1,00,A\n';
    expect(() => parseCsv(content, template)).toThrow(/Valor/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @lastro/importers test`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`packages/importers/src/csv.ts`:

```ts
import Papa from 'papaparse';
import type { CsvTemplate, ImportResult, ParsedTransaction } from './types';
import { parseAmountToCents } from './money';
import { parseStatementDate } from './dates';
import { makeDedupHash } from './dedup';

export function parseCsv(content: string, template: CsvTemplate): ImportResult {
  const parsed = Papa.parse<Record<string, string>>(content.trim(), {
    header: true,
    delimiter: template.delimiter ?? ',',
    skipEmptyLines: true,
  });

  const rows = parsed.data;
  const transactions: ParsedTransaction[] = rows.map((row, i) => {
    for (const col of [template.dateColumn, template.amountColumn, template.descriptionColumn]) {
      if (!(col in row)) {
        throw new Error(`Coluna "${col}" não encontrada no CSV (linha ${i + 1})`);
      }
    }
    const occurredAt = parseStatementDate(row[template.dateColumn]!, template.dateFormat);
    let amountCents = parseAmountToCents(row[template.amountColumn]!, template.decimalSeparator);
    if (template.invertSign) amountCents = -amountCents;
    const description = (row[template.descriptionColumn] ?? '').trim();
    return {
      occurredAt,
      amountCents,
      description,
      dedupHash: makeDedupHash({ occurredAt, amountCents, description }),
    };
  });

  return { format: 'csv', transactions, rowCount: transactions.length };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @lastro/importers test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/importers/src/csv.ts packages/importers/src/csv.test.ts
git commit -m "feat(importers): parseCsv dirigido por template, com testes"
```

---

### Task 7: `parseOfx` (TDD)

**Files:**
- Create: `packages/importers/src/ofx.test.ts`
- Create: `packages/importers/src/ofx.ts`

- [ ] **Step 1: Teste que falha**

`packages/importers/src/ofx.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseOfx } from './ofx';

const sample = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260205<TRNAMT>-15.00<FITID>A1<MEMO>iFood</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260206120000<TRNAMT>1000.00<FITID>A2<NAME>Salario</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe('parseOfx', () => {
  it('extrai transações dos blocos STMTTRN', () => {
    const result = parseOfx(sample);
    expect(result.format).toBe('ofx');
    expect(result.rowCount).toBe(2);
    expect(result.transactions[0]).toMatchObject({
      occurredAt: '2026-02-05',
      amountCents: -1500,
      description: 'iFood',
    });
    expect(result.transactions[1]).toMatchObject({
      occurredAt: '2026-02-06',
      amountCents: 100000,
      description: 'Salario',
    });
  });

  it('usa o dedupHash determinístico', () => {
    expect(parseOfx(sample).transactions[0]?.dedupHash).toMatch(/^[0-9a-f]{8}$/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @lastro/importers test`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`packages/importers/src/ofx.ts`:

```ts
import type { ImportResult, ParsedTransaction } from './types';
import { parseAmountToCents } from './money';
import { makeDedupHash } from './dedup';

/** Lê o valor de uma tag SGML simples (<TAG>valor) de dentro de um bloco. */
function tag(block: string, name: string): string | undefined {
  const m = new RegExp(`<${name}>([^<\r\n]*)`, 'i').exec(block);
  return m ? m[1]!.trim() : undefined;
}

/** Converte DTPOSTED (YYYYMMDD[hhmmss]) para 'YYYY-MM-DD'. */
function ofxDate(raw: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(raw.trim());
  if (!m) throw new Error(`DTPOSTED inválido: "${raw}"`);
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function parseOfx(content: string): ImportResult {
  const blocks = content.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  const transactions: ParsedTransaction[] = blocks.map((block) => {
    const dtposted = tag(block, 'DTPOSTED');
    const trnamt = tag(block, 'TRNAMT');
    if (!dtposted || !trnamt) {
      throw new Error('Bloco STMTTRN sem DTPOSTED ou TRNAMT');
    }
    const occurredAt = ofxDate(dtposted);
    const amountCents = parseAmountToCents(trnamt, '.');
    const description = (tag(block, 'MEMO') ?? tag(block, 'NAME') ?? '').trim();
    return {
      occurredAt,
      amountCents,
      description,
      dedupHash: makeDedupHash({ occurredAt, amountCents, description }),
    };
  });

  return { format: 'ofx', transactions, rowCount: transactions.length };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @lastro/importers test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/importers/src/ofx.ts packages/importers/src/ofx.test.ts
git commit -m "feat(importers): parseOfx (blocos STMTTRN) com testes"
```

---

### Task 8: Templates de banco

**Files:**
- Create: `packages/importers/src/templates.ts`

- [ ] **Step 1: Definir templates**

`packages/importers/src/templates.ts`:

```ts
import type { CsvTemplate } from './types';

/**
 * Templates de CSV por banco. São o melhor palpite com base nos formatos comuns;
 * ajuste as colunas/flags quando tiver um export real em mãos.
 */

// Fatura do cartão Nubank: colunas "date,title,amount" (YYYY-MM-DD), despesas positivas.
export const nubankCardTemplate: CsvTemplate = {
  name: 'Nubank — Cartão',
  dateColumn: 'date',
  amountColumn: 'amount',
  descriptionColumn: 'title',
  dateFormat: 'yyyy-mm-dd',
  decimalSeparator: '.',
  invertSign: true,
};

// Extrato da conta Nubank: "Data,Valor,Identificador,Descrição" (DD/MM/YYYY), sinal já correto.
export const nubankAccountTemplate: CsvTemplate = {
  name: 'Nubank — Conta',
  dateColumn: 'Data',
  amountColumn: 'Valor',
  descriptionColumn: 'Descrição',
  dateFormat: 'dd/mm/yyyy',
  decimalSeparator: ',',
};

// Mercado Pago (relatório de atividade): ajuste fino conforme o export real.
export const mercadoPagoTemplate: CsvTemplate = {
  name: 'Mercado Pago',
  dateColumn: 'Data',
  amountColumn: 'Valor',
  descriptionColumn: 'Descrição',
  dateFormat: 'dd/mm/yyyy',
  decimalSeparator: ',',
};

export const bankTemplates = {
  nubankCard: nubankCardTemplate,
  nubankAccount: nubankAccountTemplate,
  mercadoPago: mercadoPagoTemplate,
} as const;

export type BankTemplateKey = keyof typeof bankTemplates;
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @lastro/importers typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/importers/src/templates.ts
git commit -m "feat(importers): templates de banco (nubank/mercado pago)"
```

---

### Task 9: `detectAndParse` + API pública (TDD)

**Files:**
- Create: `packages/importers/src/detect.test.ts`
- Create: `packages/importers/src/detect.ts`
- Modify: `packages/importers/src/index.ts`

- [ ] **Step 1: Teste que falha**

`packages/importers/src/detect.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { detectAndParse } from './detect';
import { nubankAccountTemplate } from './templates';

describe('detectAndParse', () => {
  it('detecta OFX pelo conteúdo', () => {
    const ofx =
      '<OFX><STMTTRN><DTPOSTED>20260205<TRNAMT>-15.00<MEMO>iFood</STMTTRN></OFX>';
    const result = detectAndParse(ofx, {});
    expect(result.format).toBe('ofx');
    expect(result.rowCount).toBe(1);
  });

  it('usa o template de CSV quando informado', () => {
    const csv = 'Data,Valor,Descrição\n05/02/2026,-15,00,iFood\n';
    const result = detectAndParse(csv, { csvTemplate: nubankAccountTemplate });
    expect(result.format).toBe('csv');
    expect(result.transactions[0]?.amountCents).toBe(-1500);
  });

  it('erro claro se for CSV sem template', () => {
    const csv = 'Data,Valor,Descrição\n05/02/2026,-15,00,iFood\n';
    expect(() => detectAndParse(csv, {})).toThrow(/template/i);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @lastro/importers test`
Expected: FAIL.

- [ ] **Step 3: Implementar dispatcher**

`packages/importers/src/detect.ts`:

```ts
import type { CsvTemplate, ImportResult } from './types';
import { parseCsv } from './csv';
import { parseOfx } from './ofx';

function looksLikeOfx(content: string): boolean {
  const head = content.slice(0, 512).toUpperCase();
  return head.includes('OFXHEADER') || head.includes('<OFX>');
}

/** Detecta o formato e delega ao parser apropriado. */
export function detectAndParse(
  content: string,
  opts: { csvTemplate?: CsvTemplate },
): ImportResult {
  if (looksLikeOfx(content)) {
    return parseOfx(content);
  }
  if (!opts.csvTemplate) {
    throw new Error('Conteúdo CSV exige um template (csvTemplate) para ser interpretado.');
  }
  return parseCsv(content, opts.csvTemplate);
}
```

- [ ] **Step 4: API pública**

`packages/importers/src/index.ts`:

```ts
export type { ParsedTransaction, ImportResult, CsvTemplate } from './types';
export { parseAmountToCents } from './money';
export { parseStatementDate } from './dates';
export { makeDedupHash } from './dedup';
export { parseCsv } from './csv';
export { parseOfx } from './ofx';
export { detectAndParse } from './detect';
export {
  bankTemplates,
  nubankCardTemplate,
  nubankAccountTemplate,
  mercadoPagoTemplate,
} from './templates';
export type { BankTemplateKey } from './templates';
```

- [ ] **Step 5: Rodar tudo e ver passar**

Run: `pnpm --filter @lastro/importers test`
Expected: PASS (todos os arquivos).

- [ ] **Step 6: Commit**

```bash
git add packages/importers/src/detect.ts packages/importers/src/detect.test.ts packages/importers/src/index.ts
git commit -m "feat(importers): detectAndParse + API publica do pacote"
```

---

### Task 10: Verificação completa + PR

- [ ] **Step 1: Rodar a verificação igual ao CI**

Run: `pnpm install --frozen-lockfile && pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`
Expected: tudo PASS. Se `format:check` reclamar, rode `pnpm format`.

- [ ] **Step 2: Commit de ajustes (se houver) e push**

```bash
git push -u origin feat/importers
```

- [ ] **Step 3: Abrir PR e confirmar CI verde**

```bash
gh pr create --base main --head feat/importers \
  --title "feat(importers): leitura de extratos OFX/CSV com testes" \
  --body "Pacote @lastro/importers: parse de OFX e CSV (Nubank/Mercado Pago/genérico), normalização, dedup hash. Lógica pura, 100% testada."
```
Run: `gh run watch <run-id> --exit-status`
Expected: workflows `CI` e `DB` verdes.

---

## Self-Review (feita ao escrever)

- **Cobertura do design (seções 3.1 e 4):** import híbrido OFX + templates de banco + genérico ✓;
  saída normalizada compatível com a tabela `transactions` (`amountCents` int, `occurredAt`
  data, `dedup_hash`) ✓; dedup determinístico ✓.
- **Placeholders:** nenhum; todo passo tem código/comando concreto. Templates de Mercado
  Pago/Nubank marcados como "ajuste com export real" — isso é documentação honesta, não placeholder
  (o código funciona com os formatos declarados).
- **Consistência de nomes:** `ParsedTransaction`/`ImportResult`/`CsvTemplate` usados igualmente
  em types, csv, ofx, detect e index; `parseAmountToCents(raw, sep)`, `parseStatementDate(raw,
  fmt)`, `makeDedupHash({occurredAt,amountCents,description})` com assinaturas idênticas em todos
  os chamadores.

## Definition of Done

- `pnpm --filter @lastro/importers test` verde (todos os arquivos).
- `pnpm format:check`/`lint`/`typecheck`/`test` verdes no monorepo.
- CI verde no PR.
- API pública exportada e pronta para o Plano 5 (`shared`/queries) e a UI consumirem.
