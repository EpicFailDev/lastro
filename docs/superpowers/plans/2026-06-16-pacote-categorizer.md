# Pacote `categorizer` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o pacote `@lastro/categorizer` — lógica pura que sugere a categoria de uma transação a partir da descrição, usando regras (semente + aprendidas), e gera novas regras quando o usuário corrige. 100% testado, com regras-semente derivadas de comerciantes reais.

**Architecture:** Pacote isolado em `packages/categorizer`, sem UI nem dependência de banco. Tipos com Zod. `categorize()` aplica regras ordenadas por peso (regras do usuário > semente) e devolve a categoria (nome igual ao da tabela `categories`) ou `null`. `suggestRuleFromCorrection()` transforma uma correção do usuário numa regra `contains` de peso alto. Normalização de texto (minúsculas + sem acentos + espaços colapsados) garante matching robusto.

**Tech Stack:** TypeScript, Zod, Vitest.

**Pré-requisitos:** `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm"`.

---

## Estrutura de arquivos

```
packages/categorizer/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── types.ts            # CategoryRule, CategorizeResult (Zod)
    ├── normalize.ts        # normalizeText
    ├── normalize.test.ts
    ├── rules.ts            # defaultRules (derivadas de dados reais)
    ├── categorize.ts       # categorize(description, rules)
    ├── categorize.test.ts
    ├── learn.ts            # suggestRuleFromCorrection
    └── learn.test.ts
```

### Contratos

```ts
type MatchType = 'contains' | 'equals' | 'regex';

type CategoryRule = {
  matchType: MatchType;
  pattern: string;     // sempre comparado em forma normalizada
  category: string;    // nome igual ao da tabela categories (ex.: 'Alimentação')
  weight: number;      // maior vence; semente = 1, aprendida = 10
};

type CategorizeResult = {
  category: string | null;
  rule: CategoryRule | null;
};
```

---

### Task 1: Scaffold do pacote

**Files:** Create `packages/categorizer/package.json`, `tsconfig.json`, `src/index.ts`.

- [ ] **Step 1: package.json**

```json
{
  "name": "@lastro/categorizer",
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
  "dependencies": { "zod": "^3.23.8" }
}
```

- [ ] **Step 2: tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"]
}
```

- [ ] **Step 3: index.ts temporário**

```ts
export {};
```

- [ ] **Step 4:** Run `pnpm install`. Expected: zod instalado no pacote.
- [ ] **Step 5:** Commit `chore(categorizer): scaffold do pacote`.

---

### Task 2: `normalizeText` (TDD)

**Files:** `src/normalize.test.ts`, `src/normalize.ts`.

- [ ] **Step 1: Teste**

```ts
import { describe, it, expect } from 'vitest';
import { normalizeText } from './normalize';

describe('normalizeText', () => {
  it('minúsculas, sem acento, espaços colapsados', () => {
    expect(normalizeText('  Farmácia   da   SAÚDE ')).toBe('farmacia da saude');
  });
  it('remove diacríticos diversos', () => {
    expect(normalizeText('Educação')).toBe('educacao');
  });
});
```

- [ ] **Step 2:** Run `pnpm --filter @lastro/categorizer test` → FAIL.
- [ ] **Step 3: Implementar**

```ts
/** minúsculas + sem acentos + espaços colapsados. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
```

- [ ] **Step 4:** Run test → PASS.
- [ ] **Step 5:** Commit `feat(categorizer): normalizeText com testes`.

---

### Task 3: Tipos + regras-semente

**Files:** `src/types.ts`, `src/rules.ts`.

- [ ] **Step 1: types.ts**

```ts
import { z } from 'zod';

export const categoryRuleSchema = z.object({
  matchType: z.enum(['contains', 'equals', 'regex']),
  pattern: z.string().min(1),
  category: z.string().min(1),
  weight: z.number().int().positive(),
});
export type CategoryRule = z.infer<typeof categoryRuleSchema>;

export type CategorizeResult = {
  category: string | null;
  rule: CategoryRule | null;
};
```

- [ ] **Step 2: rules.ts (patterns já normalizados; derivados de comerciantes reais)**

```ts
import type { CategoryRule } from './types';

function r(pattern: string, category: string): CategoryRule {
  return { matchType: 'contains', pattern, category, weight: 1 };
}

/** Regras-semente. Patterns em forma normalizada (minúsculas, sem acento). */
export const defaultRules: CategoryRule[] = [
  // Transporte
  r('uber', 'Transporte'),
  r('cabify', 'Transporte'),
  r('99 tecnologia', 'Transporte'),
  r('posto', 'Transporte'),
  r('petroleo', 'Transporte'),
  r('petroradio', 'Transporte'),
  r('ipiranga', 'Transporte'),
  r('combustivel', 'Transporte'),
  r('estacionamento', 'Transporte'),
  r('parking', 'Transporte'),
  // Alimentação
  r('ifood', 'Alimentação'),
  r('rappi', 'Alimentação'),
  r('restaurante', 'Alimentação'),
  r('sushi', 'Alimentação'),
  r('pizza', 'Alimentação'),
  r('pastel', 'Alimentação'),
  r('padaria', 'Alimentação'),
  r('lanche', 'Alimentação'),
  r('hamburg', 'Alimentação'),
  r('acai', 'Alimentação'),
  r('supermercado', 'Alimentação'),
  r('mercado mister', 'Alimentação'),
  r('mercadinho', 'Alimentação'),
  r('hortifruti', 'Alimentação'),
  r('atacad', 'Alimentação'),
  r('conveniencia', 'Alimentação'),
  r('sendas', 'Alimentação'),
  // Saúde
  r('farmacia', 'Saúde'),
  r('drogaria', 'Saúde'),
  r('drogasil', 'Saúde'),
  r('hospital', 'Saúde'),
  r('clinica', 'Saúde'),
  r('laboratorio', 'Saúde'),
  // Contas
  r('claro', 'Contas'),
  r('vivo', 'Contas'),
  r('energia', 'Contas'),
  r('enel', 'Contas'),
  r('sabesp', 'Contas'),
  r('telefon', 'Contas'),
  // Moradia
  r('aluguel', 'Moradia'),
  r('condominio', 'Moradia'),
  r('imobiliaria', 'Moradia'),
  r('materiais de construcao', 'Moradia'),
  r('construcao', 'Moradia'),
  // Educação
  r('escola', 'Educação'),
  r('faculdade', 'Educação'),
  r('universidade', 'Educação'),
  r('curso', 'Educação'),
  // Compras
  r('amazon', 'Compras'),
  r('mercado livre', 'Compras'),
  r('shopee', 'Compras'),
  r('aliexpress', 'Compras'),
  r('magazine', 'Compras'),
  r('renner', 'Compras'),
  // Lazer
  r('netflix', 'Lazer'),
  r('spotify', 'Lazer'),
  r('cinema', 'Lazer'),
  r('steam', 'Lazer'),
  r('disney', 'Lazer'),
  // Renda
  r('rendimentos', 'Renda'),
  r('rendimento', 'Renda'),
  r('resgate', 'Renda'),
  r('salario', 'Renda'),
  r('pro labore', 'Renda'),
];
```

- [ ] **Step 3:** Run `pnpm --filter @lastro/categorizer typecheck` → PASS.
- [ ] **Step 4:** Commit `feat(categorizer): tipos e regras-semente (dados reais)`.

---

### Task 4: `categorize` (TDD)

**Files:** `src/categorize.test.ts`, `src/categorize.ts`.

- [ ] **Step 1: Teste (com descrições REAIS dos extratos)**

```ts
import { describe, it, expect } from 'vitest';
import { categorize } from './categorize';
import { defaultRules } from './rules';
import type { CategoryRule } from './types';

describe('categorize', () => {
  it('Uber → Transporte', () => {
    expect(
      categorize('Pagamento com QR Pix UBER DO BRASIL TECNOLOGIA LTDA.', defaultRules).category,
    ).toBe('Transporte');
  });
  it('Sushi → Alimentação', () => {
    expect(categorize('Pagamento com QR Pix OSHENT SUSHI LTDA', defaultRules).category).toBe(
      'Alimentação',
    );
  });
  it('Rendimentos → Renda', () => {
    expect(categorize('Rendimentos', defaultRules).category).toBe('Renda');
  });
  it('Claro → Contas', () => {
    expect(categorize('Pagamento Claro', defaultRules).category).toBe('Contas');
  });
  it('sem regra → null', () => {
    expect(categorize('Pix enviado Jenifer Fernanda Rojas', defaultRules).category).toBeNull();
  });
  it('regra de maior peso vence', () => {
    const userRule: CategoryRule = {
      matchType: 'contains',
      pattern: 'jenifer',
      category: 'Outros',
      weight: 10,
    };
    expect(
      categorize('Pix enviado Jenifer Fernanda Rojas', [...defaultRules, userRule]).category,
    ).toBe('Outros');
  });
  it('equals exige igualdade exata (normalizada)', () => {
    const rule: CategoryRule = {
      matchType: 'equals',
      pattern: 'rendimentos',
      category: 'Renda',
      weight: 5,
    };
    expect(categorize('Rendimentos', [rule]).category).toBe('Renda');
    expect(categorize('Rendimentos do mês', [rule]).category).toBeNull();
  });
  it('regex funciona', () => {
    const rule: CategoryRule = {
      matchType: 'regex',
      pattern: 'uber|99|cabify',
      category: 'Transporte',
      weight: 5,
    };
    expect(categorize('viagem 99 app', [rule]).category).toBe('Transporte');
  });
});
```

- [ ] **Step 2:** Run test → FAIL.
- [ ] **Step 3: Implementar**

```ts
import type { CategorizeResult, CategoryRule } from './types';
import { normalizeText } from './normalize';

function matches(rule: CategoryRule, normalized: string): boolean {
  const pattern = rule.matchType === 'regex' ? rule.pattern : normalizeText(rule.pattern);
  switch (rule.matchType) {
    case 'contains':
      return normalized.includes(pattern);
    case 'equals':
      return normalized === pattern;
    case 'regex':
      return new RegExp(pattern, 'i').test(normalized);
  }
}

/**
 * Sugere a categoria de uma descrição aplicando as regras.
 * Regras de maior peso vencem; empate → padrão mais longo (mais específico).
 */
export function categorize(description: string, rules: CategoryRule[]): CategorizeResult {
  const normalized = normalizeText(description);
  const ordered = [...rules].sort(
    (a, b) => b.weight - a.weight || b.pattern.length - a.pattern.length,
  );
  for (const rule of ordered) {
    if (matches(rule, normalized)) {
      return { category: rule.category, rule };
    }
  }
  return { category: null, rule: null };
}
```

- [ ] **Step 4:** Run test → PASS.
- [ ] **Step 5:** Commit `feat(categorizer): categorize com testes (descrições reais)`.

---

### Task 5: `suggestRuleFromCorrection` (TDD)

**Files:** `src/learn.test.ts`, `src/learn.ts`.

- [ ] **Step 1: Teste**

```ts
import { describe, it, expect } from 'vitest';
import { suggestRuleFromCorrection } from './learn';
import { categorize } from './categorize';

describe('suggestRuleFromCorrection', () => {
  it('cria regra contains de peso alto a partir da correção', () => {
    const rule = suggestRuleFromCorrection(
      'Pagamento com QR Pix ZHU PASTELARIA LTDA',
      'Alimentação',
    );
    expect(rule.matchType).toBe('contains');
    expect(rule.category).toBe('Alimentação');
    expect(rule.weight).toBeGreaterThan(1);
    expect(rule.pattern).toContain('zhu');
  });

  it('a regra gerada classifica a mesma descrição', () => {
    const desc = 'Pagamento com QR Pix ZHU PASTELARIA LTDA';
    const rule = suggestRuleFromCorrection(desc, 'Alimentação');
    expect(categorize(desc, [rule]).category).toBe('Alimentação');
  });

  it('remove prefixos de transferência e sufixos de empresa', () => {
    const rule = suggestRuleFromCorrection('Pix enviado Hns Representacoes Ltda', 'Outros');
    expect(rule.pattern).toBe('hns representacoes');
  });

  it('descrição vazia após limpeza lança erro', () => {
    expect(() => suggestRuleFromCorrection('Pix enviado', 'Outros')).toThrow();
  });
});
```

- [ ] **Step 2:** Run test → FAIL.
- [ ] **Step 3: Implementar**

```ts
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
```

- [ ] **Step 4:** Run test → PASS.
- [ ] **Step 5:** Commit `feat(categorizer): suggestRuleFromCorrection com testes`.

---

### Task 6: API pública + verificação + PR

**Files:** `src/index.ts`.

- [ ] **Step 1: index.ts**

```ts
export type { CategoryRule, CategorizeResult } from './types';
export { normalizeText } from './normalize';
export { defaultRules } from './rules';
export { categorize } from './categorize';
export { suggestRuleFromCorrection } from './learn';
```

- [ ] **Step 2:** Run `pnpm install --frozen-lockfile && pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`. Expected: tudo PASS (rode `pnpm format` se necessário).
- [ ] **Step 3:** Commit `feat(categorizer): API publica`, push `feat/categorizer`.
- [ ] **Step 4:** Abrir PR e confirmar CI verde.

---

## Self-Review (feita ao escrever)

- **Cobertura do design (seção 5.2):** regras + aprendizado das correções ✓; categorias =
  nomes da tabela `categories` ✓; zero custo de IA ✓.
- **Placeholders:** nenhum; todo passo tem código/comando. Regras-semente derivadas de dados reais.
- **Consistência de nomes:** `CategoryRule`/`CategorizeResult` iguais em types, categorize,
  learn, index; `categorize(description, rules)` e `suggestRuleFromCorrection(description,
  category)` com assinaturas idênticas nos chamadores; `normalizeText` reutilizado em
  categorize e learn.

## Definition of Done

- `pnpm --filter @lastro/categorizer test` verde.
- Monorepo verde (lint/typecheck/test/format).
- CI verde no PR. API pronta para o Plano 5/UI consumirem.
