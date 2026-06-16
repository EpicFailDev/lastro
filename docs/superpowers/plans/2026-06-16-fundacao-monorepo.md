# Fundação do Monorepo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estabelecer o monorepo do Lastro com pnpm + Turborepo, TypeScript strict, ESLint/Prettier, Vitest e CI no GitHub Actions — tudo verde.

**Architecture:** Monorepo com `pnpm workspaces` orquestrado por Turborepo. Pacotes em `packages/*` e apps em `apps/*`. Config de TS, lint e teste compartilhada na raiz. Um pacote `packages/shared` nasce com uma função trivial testada, provando que a cadeia typecheck→lint→test→CI funciona ponta a ponta antes de qualquer feature real.

**Tech Stack:** pnpm, Turborepo, TypeScript (strict), ESLint, Prettier, Vitest, GitHub Actions.

**Pré-requisitos do ambiente:** Node.js LTS (≥ 20) e pnpm instalados. Verificar com `node -v` e `pnpm -v`. Se faltar pnpm: `npm install -g pnpm`.

---

## Estrutura de arquivos (criada por este plano)

```
lastro/
├── package.json                 # raiz: scripts + devDeps compartilhadas
├── pnpm-workspace.yaml          # define os globs do workspace
├── turbo.json                   # pipeline (build, lint, test, typecheck)
├── tsconfig.base.json           # config TS base (strict) herdada pelos pacotes
├── .eslintrc.cjs                # regras de lint
├── .prettierrc.json             # formatação
├── .nvmrc                       # versão do Node
├── packages/
│   └── shared/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── money.ts         # função real e testável (centavos)
│           └── money.test.ts
└── .github/workflows/ci.yml     # lint + typecheck + test por push/PR
```

> **Por que `money.ts` como primeira função?** É lógica de verdade que o app inteiro vai
> usar (formatar centavos), e exercita o setup de teste com algo significativo — não um
> `add(a,b)` descartável.

---

### Task 1: Versão do Node e workspace pnpm

**Files:**
- Create: `.nvmrc`
- Create: `pnpm-workspace.yaml`

- [ ] **Step 1: Fixar a versão do Node**

Crie `.nvmrc`:

```
20
```

- [ ] **Step 2: Definir o workspace**

Crie `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Commit**

```bash
git add .nvmrc pnpm-workspace.yaml
git commit -m "chore: define workspace pnpm e versao do node"
```

---

### Task 2: package.json raiz com scripts e devDeps

**Files:**
- Create: `package.json`

- [ ] **Step 1: Criar o package.json raiz**

```json
{
  "name": "lastro",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "format": "prettier --write \"**/*.{ts,tsx,js,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,json,md}\""
  },
  "devDependencies": {
    "turbo": "^2.1.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "prettier": "^3.3.0",
    "eslint": "^8.57.0",
    "@typescript-eslint/parser": "^8.8.0",
    "@typescript-eslint/eslint-plugin": "^8.8.0"
  }
}
```

- [ ] **Step 2: Instalar dependências**

Run: `pnpm install`
Expected: cria `node_modules/` e `pnpm-lock.yaml` sem erros.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: package.json raiz com scripts e devDeps compartilhadas"
```

---

### Task 3: Pipeline do Turborepo

**Files:**
- Create: `turbo.json`

- [ ] **Step 1: Criar turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add turbo.json
git commit -m "chore: pipeline do turborepo (build/lint/typecheck/test)"
```

---

### Task 4: TypeScript base (strict)

**Files:**
- Create: `tsconfig.base.json`

- [ ] **Step 1: Criar tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add tsconfig.base.json
git commit -m "chore: tsconfig base com strict habilitado"
```

---

### Task 5: ESLint + Prettier

**Files:**
- Create: `.prettierrc.json`
- Create: `.eslintrc.cjs`

- [ ] **Step 1: Criar .prettierrc.json**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 2: Criar .eslintrc.cjs**

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true, es2022: true },
  ignorePatterns: ['dist', 'node_modules', '*.config.*'],
};
```

- [ ] **Step 3: Verificar formatação**

Run: `pnpm format:check`
Expected: PASS (sem arquivos fora do padrão) ou lista de arquivos a formatar — nesse caso rode `pnpm format`.

- [ ] **Step 4: Commit**

```bash
git add .prettierrc.json .eslintrc.cjs
git commit -m "chore: configura eslint e prettier"
```

---

### Task 6: Pacote `shared` com função `formatMoney` (TDD)

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/money.test.ts`
- Create: `packages/shared/src/money.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Criar package.json do pacote**

`packages/shared/package.json`:

```json
{
  "name": "@lastro/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint src",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Criar tsconfig do pacote**

`packages/shared/tsconfig.json`:

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

- [ ] **Step 3: Escrever o teste que falha**

`packages/shared/src/money.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney', () => {
  it('formata centavos como reais', () => {
    expect(formatMoney(12345)).toBe('R$ 123,45');
  });

  it('formata zero', () => {
    expect(formatMoney(0)).toBe('R$ 0,00');
  });

  it('formata valores negativos (despesa)', () => {
    expect(formatMoney(-500)).toBe('-R$ 5,00');
  });
});
```

- [ ] **Step 4: Rodar o teste e ver falhar**

Run: `pnpm --filter @lastro/shared test`
Expected: FAIL — "Cannot find module './money'" / `formatMoney is not a function`.

- [ ] **Step 5: Implementar o mínimo pra passar**

`packages/shared/src/money.ts`:

```ts
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
```

- [ ] **Step 6: Criar o index do pacote**

`packages/shared/src/index.ts`:

```ts
export { formatMoney } from './money';
```

- [ ] **Step 7: Rodar o teste e ver passar**

Run: `pnpm --filter @lastro/shared test`
Expected: PASS (3 testes).

> Nota: o `Intl` usa espaço não separável (` `) entre `R$` e o número — por isso os
> testes usam ` `. Se o ambiente Node não trouxer o ICU completo, o separador pode
> variar; nesse caso, confirme o output real com um `console.log(formatMoney(12345))` e
> ajuste o teste para o caractere efetivo antes de prosseguir.

- [ ] **Step 8: Typecheck e lint do pacote**

Run: `pnpm --filter @lastro/shared typecheck && pnpm --filter @lastro/shared lint`
Expected: PASS sem erros.

- [ ] **Step 9: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): formatMoney com testes (centavos -> BRL)"
```

---

### Task 7: CI no GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Criar o workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm format:check
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
```

- [ ] **Step 2: Rodar a verificação completa localmente (igual ao CI)**

Run: `pnpm install --frozen-lockfile && pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`
Expected: todas as etapas PASS.

- [ ] **Step 3: Commit e push**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: lint, typecheck e testes no github actions"
git push origin HEAD
```

- [ ] **Step 4: Confirmar o CI verde**

Run: `gh run watch` (ou veja a aba Actions no GitHub)
Expected: workflow `CI` concluído com sucesso (verde).

---

## Self-Review (feita ao escrever)

- **Cobertura do spec (seção 2 do design):** pnpm+Turborepo ✓, TypeScript strict ✓,
  ESLint+Prettier ✓, Vitest ✓, GitHub Actions ✓, estrutura `packages/` ✓. As escolhas de
  app (Expo, Vite, Tailwind) e demais pacotes pertencem aos planos 2–7, não a este.
- **Placeholders:** nenhum TODO/TBD; todo passo tem conteúdo ou comando concreto.
- **Consistência de tipos/nomes:** `formatMoney(amountCents: number)` definido na Task 6 e
  exportado no `index.ts` da mesma task; nomes de scripts (`build/lint/typecheck/test`)
  batem entre `package.json` raiz, `turbo.json`, `package.json` do pacote e o CI.

## Definition of Done

- `pnpm install` limpo, `pnpm lint`/`typecheck`/`test`/`format:check` verdes localmente.
- Pacote `@lastro/shared` com `formatMoney` testado (3 testes passando).
- CI verde no GitHub Actions na branch `main`.
