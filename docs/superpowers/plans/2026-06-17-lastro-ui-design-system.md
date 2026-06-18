# Lastro `@lastro/ui` Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o pacote `@lastro/ui` com tokens de design (primitivos + semânticos), temas claro/escuro, preset Tailwind e testes de contraste/integridade.

**Architecture:** TS puro sem build (igual a `shared`/`data`). `primitives.ts` (valores crus) → `semantic.ts` (papéis por tema) → derivados: `themes.ts` (consumo TS/mobile), `css-vars.ts` (troca de tema web) e `tailwind-preset.cjs` (utilitários web). `semantic.ts` é a única fonte da verdade; os derivados nunca reintroduzem hex à mão.

**Tech Stack:** TypeScript strict, Vitest 2.1, ESLint, Prettier, Tailwind (preset CommonJS). pnpm + Turborepo.

## Global Constraints

- TS puro, **sem build step**: `main` e `types` apontam para `./src/index.ts`. Consumo via `workspace:*`.
- TypeScript **strict** herdando `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`).
- React é **`peerDependency`** (`>=18`); `@types/react` + `react` em devDependencies.
- Scripts por pacote: `lint` = `eslint src`, `typecheck` = `tsc --noEmit`, `test` = `vitest run`.
- Testes importam explicitamente de `vitest` (`import { describe, it, expect } from 'vitest'`) — sem globals.
- Cores em hex `#RRGGBB` minúsculo/maiúsculo consistente (usar maiúsculo). Nenhum hex repetido entre `semantic` e derivados.
- Valor monetário é apresentação aqui (só cor); a lógica de centavos vive em `@lastro/shared`/`data`.
- Trabalhar no worktree já criado: `c:\Users\guilh\OneDrive\Documentos\GitHub\lastro\.claude\worktrees\ui-design-system`.
- Comandos rodam da raiz do repo. Filtrar o pacote com `pnpm --filter @lastro/ui <script>`.

---

### Task 1: Scaffold do pacote `@lastro/ui`

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: nada (primeira tarefa).
- Produces: pacote `@lastro/ui` resolvível via `workspace:*`; `src/index.ts` como ponto de entrada.

- [ ] **Step 1: Criar `packages/ui/package.json`**

```json
{
  "name": "@lastro/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./tailwind-preset": "./tailwind-preset.cjs"
  },
  "scripts": {
    "lint": "eslint src",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "peerDependencies": { "react": ">=18" },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "react": "^18.3.0"
  }
}
```

- [ ] **Step 2: Criar `packages/ui/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"]
}
```

- [ ] **Step 3: Criar `packages/ui/src/index.ts` (placeholder mínimo)**

```ts
export {};
```

- [ ] **Step 4: Instalar e verificar typecheck**

Run: `pnpm install && pnpm --filter @lastro/ui typecheck`
Expected: instala sem erro e `tsc --noEmit` passa (sem saída de erro).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/package.json packages/ui/tsconfig.json packages/ui/src/index.ts pnpm-lock.yaml
git commit -m "feat(ui): scaffold do pacote @lastro/ui"
```

---

### Task 2: Tokens primitivos

**Files:**
- Create: `packages/ui/src/primitives.ts`
- Test: `packages/ui/src/primitives.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `export const color` — objeto com famílias `teal`, `aqua`, `coral`, `neutral`, `feedback`; cada família é `Record<string, string>` (hex). `neutral` indexado por `'0'|'50'|...|'900'`.
  - `export const space: Record<string, number>`, `radius: Record<string, number>`, `fontSize: Record<string, [number, number]>` (size, lineHeight em px), `fontWeight: Record<string, number>`, `shadow: Record<'sm'|'md'|'lg', string>`.
  - `export type Hex = string`.

- [ ] **Step 1: Escrever o teste que falha (`primitives.test.ts`)**

```ts
import { describe, it, expect } from 'vitest';
import { color, space, radius, fontSize } from './primitives';

const HEX = /^#[0-9A-F]{6}$/;

describe('primitives', () => {
  it('toda cor é hex #RRGGBB maiúsculo', () => {
    const all = [
      ...Object.values(color.teal),
      ...Object.values(color.aqua),
      ...Object.values(color.coral),
      ...Object.values(color.neutral),
      ...Object.values(color.feedback),
    ];
    expect(all.length).toBeGreaterThan(0);
    for (const c of all) expect(c).toMatch(HEX);
  });

  it('tem a base teal-500 da marca', () => {
    expect(color.teal['500']).toBe('#1F7A7D');
  });

  it('escalas numéricas são positivas e fontSize traz [size, lineHeight]', () => {
    expect(space['4']).toBe(16);
    expect(radius.md).toBe(10);
    expect(fontSize.base).toEqual([16, 24]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @lastro/ui test`
Expected: FAIL — `Cannot find module './primitives'`.

- [ ] **Step 3: Implementar `primitives.ts`**

```ts
export type Hex = string;

export const color = {
  teal: {
    '50': '#ECF6F6', '100': '#CFE8E8', '200': '#9FD0D1', '300': '#6BB4B6',
    '400': '#3E9598', '500': '#1F7A7D', '600': '#155E61', '700': '#0F4749',
    '800': '#0A3335', '900': '#062123',
  },
  aqua: { '400': '#4FD1C5', '500': '#2BB6A8' },
  coral: { '300': '#FF9488', '400': '#FF7A6B', '500': '#FF6B5A', '600': '#E55444' },
  neutral: {
    '0': '#FFFFFF', '50': '#F7F9F9', '100': '#EEF2F2', '200': '#DDE4E4',
    '300': '#C2CCCC', '400': '#95A3A3', '500': '#6B7878', '600': '#4C5757',
    '700': '#364040', '800': '#222A2A', '900': '#141A1A',
  },
  feedback: {
    success: '#1FA67A', successLight: '#3FBF93',
    danger: '#E5484D', dangerLight: '#F76A6E',
    warning: '#F5A623',
  },
} as const;

export const space: Record<string, number> = {
  '0': 0, '1': 4, '2': 8, '3': 12, '4': 16, '5': 20,
  '6': 24, '8': 32, '10': 40, '12': 48, '16': 64,
};

export const radius: Record<string, number> = {
  sm: 6, md: 10, lg: 16, xl: 24, full: 9999,
};

export const fontSize: Record<string, [number, number]> = {
  xs: [12, 16], sm: [14, 20], base: [16, 24], lg: [18, 28],
  xl: [20, 28], '2xl': [24, 32], '3xl': [30, 36], '4xl': [36, 40],
};

export const fontWeight: Record<string, number> = {
  regular: 400, medium: 500, semibold: 600, bold: 700,
};

export const shadow: Record<'sm' | 'md' | 'lg', string> = {
  sm: '0 1px 2px rgba(6, 33, 35, 0.06)',
  md: '0 4px 12px rgba(6, 33, 35, 0.08)',
  lg: '0 12px 32px rgba(6, 33, 35, 0.12)',
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @lastro/ui test`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/primitives.ts packages/ui/src/primitives.test.ts
git commit -m "feat(ui): tokens primitivos (paleta + escalas)"
```

---

### Task 3: Utilitário de contraste WCAG

**Files:**
- Create: `packages/ui/src/contrast.ts`
- Test: `packages/ui/src/contrast.test.ts` (apenas a correção da fórmula nesta task; pares de tokens entram na Task 5)

**Interfaces:**
- Consumes: nada.
- Produces: `export function contrastRatio(fg: string, bg: string): number` — razão de contraste WCAG 2.1 (1..21), aceita `#RRGGBB`.

- [ ] **Step 1: Escrever o teste que falha (`contrast.test.ts`)**

```ts
import { describe, it, expect } from 'vitest';
import { contrastRatio } from './contrast';

describe('contrastRatio', () => {
  it('preto sobre branco é 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });

  it('mesma cor é 1:1', () => {
    expect(contrastRatio('#1F7A7D', '#1F7A7D')).toBeCloseTo(1, 5);
  });

  it('é simétrico (ordem não importa)', () => {
    const a = contrastRatio('#141A1A', '#FFFFFF');
    const b = contrastRatio('#FFFFFF', '#141A1A');
    expect(a).toBeCloseTo(b, 5);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @lastro/ui test contrast`
Expected: FAIL — `Cannot find module './contrast'`.

- [ ] **Step 3: Implementar `contrast.ts`**

```ts
function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) throw new Error(`Hex inválido: ${hex}`);
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 0xff;
  const g = (int >> 8) & 0xff;
  const b = int & 0xff;
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @lastro/ui test contrast`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/contrast.ts packages/ui/src/contrast.test.ts
git commit -m "feat(ui): util de contraste WCAG"
```

---

### Task 4: Tokens semânticos + temas

**Files:**
- Create: `packages/ui/src/semantic.ts`
- Create: `packages/ui/src/themes.ts`
- Test: `packages/ui/src/tokens.test.ts`

**Interfaces:**
- Consumes: `color` de `./primitives`.
- Produces:
  - `export type SemanticTokens = { 'bg.canvas': string; 'bg.surface': string; 'bg.subtle': string; 'border': string; 'text.primary': string; 'text.muted': string; 'text.onAccent': string; 'brand': string; 'accent': string; 'accent.hover': string; 'amount.positive': string; 'amount.negative': string; 'focusRing': string; }`
  - `export const semantic: { light: SemanticTokens; dark: SemanticTokens }` (em `semantic.ts`).
  - `export type ThemeName = 'light' | 'dark'`; `export const themes` reexporta `semantic`; `export const tokenKeys: (keyof SemanticTokens)[]` (em `themes.ts`).

- [ ] **Step 1: Escrever o teste que falha (`tokens.test.ts`)**

```ts
import { describe, it, expect } from 'vitest';
import { semantic } from './semantic';
import { tokenKeys } from './themes';

const HEX = /^#[0-9A-F]{6}$/;

describe('tokens semânticos', () => {
  it('light e dark têm exatamente as mesmas chaves', () => {
    const l = Object.keys(semantic.light).sort();
    const d = Object.keys(semantic.dark).sort();
    expect(l).toEqual(d);
  });

  it('tokenKeys cobre todas as chaves do tema', () => {
    expect([...tokenKeys].sort()).toEqual(Object.keys(semantic.light).sort());
  });

  it('todo valor resolve para um hex válido nos dois temas', () => {
    for (const theme of [semantic.light, semantic.dark]) {
      for (const v of Object.values(theme)) expect(v).toMatch(HEX);
    }
  });

  it('accent (coral) difere de amount.negative (vermelho)', () => {
    expect(semantic.light.accent).not.toBe(semantic.light['amount.negative']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @lastro/ui test tokens`
Expected: FAIL — `Cannot find module './semantic'`.

- [ ] **Step 3: Implementar `semantic.ts`**

```ts
import { color } from './primitives';

export type SemanticTokens = {
  'bg.canvas': string;
  'bg.surface': string;
  'bg.subtle': string;
  'border': string;
  'text.primary': string;
  'text.muted': string;
  'text.onAccent': string;
  'brand': string;
  'accent': string;
  'accent.hover': string;
  'amount.positive': string;
  'amount.negative': string;
  'focusRing': string;
};

const light: SemanticTokens = {
  'bg.canvas': color.neutral['50'],
  'bg.surface': color.neutral['0'],
  'bg.subtle': color.neutral['100'],
  'border': color.neutral['200'],
  'text.primary': color.neutral['900'],
  'text.muted': color.neutral['600'],
  'text.onAccent': color.neutral['900'],
  'brand': color.teal['500'],
  'accent': color.coral['500'],
  'accent.hover': color.coral['600'],
  'amount.positive': color.feedback.success,
  'amount.negative': color.feedback.danger,
  'focusRing': color.coral['500'],
};

const dark: SemanticTokens = {
  'bg.canvas': color.neutral['900'],
  'bg.surface': '#1C2424',
  'bg.subtle': color.neutral['800'],
  'border': color.neutral['700'],
  'text.primary': color.neutral['50'],
  'text.muted': color.neutral['400'],
  'text.onAccent': color.neutral['900'],
  'brand': color.teal['300'],
  'accent': color.coral['400'],
  'accent.hover': color.coral['500'],
  'amount.positive': color.feedback.successLight,
  'amount.negative': color.feedback.dangerLight,
  'focusRing': color.coral['400'],
};

export const semantic: { light: SemanticTokens; dark: SemanticTokens } = { light, dark };
```

> Nota: `#1C2424` é uma superfície dark intencional (entre neutral-800 e -900); é o único hex literal do semântico e está documentado no spec.

- [ ] **Step 4: Implementar `themes.ts`**

```ts
import { semantic, type SemanticTokens } from './semantic';

export type ThemeName = 'light' | 'dark';

export const themes = semantic;

export const tokenKeys = Object.keys(semantic.light) as (keyof SemanticTokens)[];
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter @lastro/ui test tokens`
Expected: PASS (4 testes).

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/semantic.ts packages/ui/src/themes.ts packages/ui/src/tokens.test.ts
git commit -m "feat(ui): tokens semânticos + temas claro/escuro"
```

---

### Task 5: Teste de contraste sobre os pares reais de tokens

**Files:**
- Modify: `packages/ui/src/contrast.test.ts` (acrescentar bloco que usa `semantic`)

**Interfaces:**
- Consumes: `contrastRatio` de `./contrast`; `semantic` de `./semantic`.
- Produces: garantia de que a paleta passa AA — nenhuma nova export.

- [ ] **Step 1: Acrescentar o bloco de teste (no fim de `contrast.test.ts`)**

```ts
import { semantic } from './semantic';

describe('contraste dos pares semânticos (WCAG AA)', () => {
  const themes = [
    ['light', semantic.light],
    ['dark', semantic.dark],
  ] as const;

  for (const [name, t] of themes) {
    const backgrounds = [t['bg.surface'], t['bg.canvas'], t['bg.subtle']];

    it(`${name}: text.primary >= 4.5 sobre todos os fundos`, () => {
      for (const bg of backgrounds) {
        expect(contrastRatio(t['text.primary'], bg)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${name}: text.muted >= 4.5 sobre todos os fundos`, () => {
      for (const bg of backgrounds) {
        expect(contrastRatio(t['text.muted'], bg)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${name}: text.onAccent >= 4.5 sobre accent`, () => {
      expect(contrastRatio(t['text.onAccent'], t['accent'])).toBeGreaterThanOrEqual(4.5);
    });

    it(`${name}: valores (positivo/negativo) >= 3 sobre surface`, () => {
      expect(contrastRatio(t['amount.positive'], t['bg.surface'])).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(t['amount.negative'], t['bg.surface'])).toBeGreaterThanOrEqual(3);
    });
  }
});
```

- [ ] **Step 2: Rodar e ver passar**

Run: `pnpm --filter @lastro/ui test contrast`
Expected: PASS — todos os pares atendem (AA 4.5 para texto, 3:1 para valores), nos dois temas.

> Se algum par reprovar: o valor está no `semantic.ts` (única fonte). Ajustar o token lá, nunca afrouxar o limite do teste.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/contrast.test.ts
git commit -m "test(ui): contraste AA dos pares semânticos nos dois temas"
```

---

### Task 6: Geração de variáveis CSS

**Files:**
- Create: `packages/ui/src/css-vars.ts`
- Test: `packages/ui/src/css-vars.test.ts`

**Interfaces:**
- Consumes: `semantic` de `./semantic`; `tokenKeys` de `./themes`.
- Produces:
  - `export function cssVarName(token: string): string` — `'text.primary'` → `'--text-primary'` (pontos viram hífen).
  - `export function themeCssVars(theme: SemanticTokens): Record<string, string>` — mapa nome-da-var → hex.
  - `export function themeCss(): string` — string CSS com blocos `:root { ... }` e `.dark { ... }`.

- [ ] **Step 1: Escrever o teste que falha (`css-vars.test.ts`)**

```ts
import { describe, it, expect } from 'vitest';
import { cssVarName, themeCssVars, themeCss } from './css-vars';
import { semantic } from './semantic';

describe('css-vars', () => {
  it('cssVarName troca pontos por hífen e prefixa --', () => {
    expect(cssVarName('text.primary')).toBe('--text-primary');
    expect(cssVarName('bg.surface')).toBe('--bg-surface');
  });

  it('themeCssVars cobre todos os tokens do tema', () => {
    const vars = themeCssVars(semantic.light);
    expect(Object.keys(vars)).toHaveLength(Object.keys(semantic.light).length);
    expect(vars['--text-primary']).toBe(semantic.light['text.primary']);
  });

  it('themeCss inclui blocos :root e .dark com as variáveis', () => {
    const css = themeCss();
    expect(css).toContain(':root {');
    expect(css).toContain('.dark {');
    expect(css).toContain(`--accent: ${semantic.light.accent};`);
    expect(css).toContain(`--accent: ${semantic.dark.accent};`);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @lastro/ui test css-vars`
Expected: FAIL — `Cannot find module './css-vars'`.

- [ ] **Step 3: Implementar `css-vars.ts`**

```ts
import { semantic, type SemanticTokens } from './semantic';
import { tokenKeys } from './themes';

export function cssVarName(token: string): string {
  return `--${token.replace(/\./g, '-')}`;
}

export function themeCssVars(theme: SemanticTokens): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of tokenKeys) out[cssVarName(key)] = theme[key];
  return out;
}

function block(selector: string, vars: Record<string, string>): string {
  const lines = Object.entries(vars).map(([name, value]) => `  ${name}: ${value};`);
  return `${selector} {\n${lines.join('\n')}\n}`;
}

export function themeCss(): string {
  return [
    block(':root', themeCssVars(semantic.light)),
    block('.dark', themeCssVars(semantic.dark)),
  ].join('\n\n');
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @lastro/ui test css-vars`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/css-vars.ts packages/ui/src/css-vars.test.ts
git commit -m "feat(ui): geração de variáveis CSS por tema"
```

---

### Task 7: Preset Tailwind + API pública

**Files:**
- Create: `packages/ui/tailwind-preset.cjs`
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/src/index.test.ts`

**Interfaces:**
- Consumes: tudo das tasks anteriores (via `src/index.ts`).
- Produces:
  - `src/index.ts` reexporta: `color, space, radius, fontSize, fontWeight, shadow` (primitives); `semantic, type SemanticTokens` (semantic); `themes, tokenKeys, type ThemeName` (themes); `contrastRatio` (contrast); `cssVarName, themeCssVars, themeCss` (css-vars).
  - `tailwind-preset.cjs` — objeto de preset Tailwind (`darkMode: 'class'`, `theme.extend.{colors,spacing,borderRadius,boxShadow}`), cores apontando para `var(--…)`.

- [ ] **Step 1: Escrever o teste que falha (`index.test.ts`)**

```ts
import { describe, it, expect } from 'vitest';
import * as ui from './index';

describe('API pública @lastro/ui', () => {
  it('reexporta tokens, temas e utilitários principais', () => {
    expect(ui.color.teal['500']).toBe('#1F7A7D');
    expect(ui.semantic.light['accent']).toBeDefined();
    expect(ui.tokenKeys.length).toBeGreaterThan(0);
    expect(typeof ui.contrastRatio).toBe('function');
    expect(typeof ui.themeCss).toBe('function');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @lastro/ui test index`
Expected: FAIL — exports `undefined` (index ainda é `export {}`).

- [ ] **Step 3: Implementar `src/index.ts`**

```ts
export { color, space, radius, fontSize, fontWeight, shadow, type Hex } from './primitives';
export { semantic, type SemanticTokens } from './semantic';
export { themes, tokenKeys, type ThemeName } from './themes';
export { contrastRatio } from './contrast';
export { cssVarName, themeCssVars, themeCss } from './css-vars';
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @lastro/ui test index`
Expected: PASS (1 teste).

- [ ] **Step 5: Criar `packages/ui/tailwind-preset.cjs`**

```js
/**
 * Preset Tailwind do Lastro. Consumo em apps/web:
 *   module.exports = { presets: [require('@lastro/ui/tailwind-preset')] }
 * As cores apontam para variáveis CSS injetadas via themeCss() (:root / .dark).
 */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        subtle: 'var(--bg-subtle)',
        border: 'var(--border)',
        'text-primary': 'var(--text-primary)',
        'text-muted': 'var(--text-muted)',
        'on-accent': 'var(--text-onAccent)',
        brand: 'var(--brand)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'amount-positive': 'var(--amount-positive)',
        'amount-negative': 'var(--amount-negative)',
        'focus-ring': 'var(--focusRing)',
      },
      spacing: {
        1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px',
        6: '24px', 8: '32px', 10: '40px', 12: '48px', 16: '64px',
      },
      borderRadius: { sm: '6px', md: '10px', lg: '16px', xl: '24px', full: '9999px' },
      boxShadow: {
        sm: '0 1px 2px rgba(6, 33, 35, 0.06)',
        md: '0 4px 12px rgba(6, 33, 35, 0.08)',
        lg: '0 12px 32px rgba(6, 33, 35, 0.12)',
      },
    },
  },
};
```

> Nota de consistência: os nomes de var devem casar com `cssVarName()`. `text.onAccent` → `--text-onAccent` e `focusRing` → `--focusRing` (sem ponto, não viram hífen). O preset usa exatamente esses nomes.

- [ ] **Step 6: Teste de shape do preset (acrescentar a `index.test.ts`)**

```ts
import { createRequire } from 'node:module';
import { themeCssVars } from './index';
import { semantic } from './semantic';

const requireCjs = createRequire(import.meta.url);
const preset = requireCjs('../tailwind-preset.cjs') as {
  darkMode: string;
  theme: { extend: { colors: Record<string, string>; borderRadius: Record<string, string>; boxShadow: Record<string, string> } };
};

describe('tailwind-preset', () => {
  it('é class-based e estende cores/espaço/raio/sombra', () => {
    expect(preset.darkMode).toBe('class');
    expect(preset.theme.extend.colors.accent).toBe('var(--accent)');
    expect(preset.theme.extend.borderRadius.md).toBe('10px');
    expect(preset.theme.extend.boxShadow.md).toContain('rgba');
  });

  it('toda var de cor do preset existe nas css-vars geradas', () => {
    const generated = themeCssVars(semantic.light); // nomes '--xxx'
    const used = Object.values(preset.theme.extend.colors)
      .map((v) => String(v).replace(/^var\((--[^)]+)\)$/, '$1'));
    for (const name of used) expect(generated[name]).toBeDefined();
  });
});
```

- [ ] **Step 7: Rodar a suíte inteira do pacote**

Run: `pnpm --filter @lastro/ui test`
Expected: PASS — todos os arquivos de teste (primitives, contrast, tokens, css-vars, index + preset).

> Se o teste "toda var de cor do preset existe" falhar, há divergência de nome entre o preset e `cssVarName()`. Corrigir o nome no preset (fonte do erro), não o teste.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src/index.ts packages/ui/src/index.test.ts packages/ui/tailwind-preset.cjs
git commit -m "feat(ui): API pública + preset Tailwind"
```

---

### Task 8: Verificação verde completa do monorepo

**Files:** nenhum (gate de qualidade).

**Interfaces:**
- Consumes: o pacote completo.
- Produces: confirmação de que lint + typecheck + testes + format passam no agregado (padrão do projeto antes de PR).

- [ ] **Step 1: Lint do pacote**

Run: `pnpm --filter @lastro/ui lint`
Expected: sem erros.

- [ ] **Step 2: Typecheck do pacote**

Run: `pnpm --filter @lastro/ui typecheck`
Expected: sem erros.

- [ ] **Step 3: Verificação agregada (turbo)**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: todos os pacotes verdes (nenhuma regressão em `shared`/`importers`/`categorizer`/`data`).

- [ ] **Step 4: Checagem de formatação**

Run: `pnpm format:check`
Expected: sem arquivos fora do padrão. Se acusar, rodar `pnpm format` e commitar.

- [ ] **Step 5: Commit final (se `format` mexeu em algo)**

```bash
git add -A
git commit -m "chore(ui): formatação e verificação verde do design system"
```

---

## Notas de execução

- **Ordem das tasks importa** (cada uma depende das anteriores): 1→2→3→4→5→6→7→8.
- Cada task termina verde e commitada antes da próxima.
- Ao final, integrar via skill `finishing-a-development-branch` (PR `@lastro/ui`, squash merge, limpeza do worktree) — padrão um-PR-por-pacote do repo.
- Próximas fatias (fora deste plano): `apps/web` consumindo o preset; depois `apps/mobile`.
