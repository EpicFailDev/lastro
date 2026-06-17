# Lastro — `packages/ui` (Design System v1) — Spec

> **Lastro — equilíbrio pras suas finanças.**
> Fonte única da verdade visual do app: tokens de design compartilhados por web e mobile.

- **Data:** 2026-06-17
- **Autor:** Guilherme (com Claude)
- **Status:** Aprovado para implementação
- **Pacote:** `@lastro/ui`
- **Design de produto:** `docs/superpowers/specs/2026-06-16-lastro-design.md`

---

## 1. Propósito e escopo

`packages/ui` é a **fonte única da verdade visual** do Lastro. Na v1 ele entrega **apenas tokens de design** (não componentes): cores, espaçamento, tipografia, raios e sombras, em temas claro e escuro, mais a ponte de consumo para o Tailwind (web).

**Por que tokens-only:** componentes web (`<div>`) e mobile (`<View>`) são tecnicamente diferentes; forçar um componente único entre React e React Native acopla o que deveria ser livre. Compartilhar **tokens** garante identidade visual idêntica nos dois apps sem acoplar a árvore de UI. Os componentes nascem por plataforma, dentro de `apps/web` e `apps/mobile`, consumindo estes tokens.

### Em escopo (v1)

- Tokens **primitivos** (valores crus) e **semânticos** (papéis de uso).
- Temas **claro e escuro**.
- **Preset Tailwind** consumível por `apps/web`, com troca de tema por variáveis CSS.
- **Testes** (Vitest): contraste WCAG AA e integridade dos tokens.

### Fora de escopo (v1)

- Componentes React/React Native (ficam nos apps).
- Integração NativeWind/mobile (o pacote já expõe `themes.ts` pronto para isso; a fiação fica no `apps/mobile`).
- Ícones, ilustrações, animações.

---

## 2. Convenções do pacote (alinhadas ao monorepo)

Segue exatamente o padrão dos pacotes existentes (`shared`, `data`):

- **TS puro, sem build step.** `main` e `types` apontam para `./src/index.ts`; consumido via `workspace:*`.
- **TypeScript strict** herdando `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`).
- **React como `peerDependency`** (`>=18`) — embora a v1 não tenha componentes, mantém o padrão e libera evolução.
- Scripts por pacote: `lint` (`eslint src`), `typecheck` (`tsc --noEmit`), `test` (`vitest run`).
- ESLint (`.eslintrc.cjs` da raiz) + Prettier.
- CI existente roda lint + typecheck + testes por push — nada novo a configurar.

`package.json`:

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
  "devDependencies": { "@types/react": "^18.3.0", "react": "^18.3.0" }
}
```

---

## 3. Arquitetura e estrutura de arquivos

```
packages/ui/
├── package.json
├── tsconfig.json          # extends ../../tsconfig.base.json
├── tailwind-preset.cjs    # preset consumível por apps/web (CommonJS p/ Tailwind)
└── src/
    ├── index.ts           # API pública (re-exporta tokens, temas e tipos)
    ├── primitives.ts      # paleta crua + escalas (espaço, fonte, raio, sombra)
    ├── semantic.ts        # papéis semânticos light + dark → primitivos
    ├── themes.ts          # monta { light, dark } e tipos Theme / SemanticTokens
    ├── css-vars.ts        # gera variáveis CSS (:root e .dark) a partir do semântico
    ├── contrast.ts        # razão de contraste (WCAG) — usada nos testes
    ├── contrast.test.ts
    └── tokens.test.ts
```

**Princípio de isolamento:** cada arquivo tem um propósito único.
- `primitives.ts` — valores sem significado de uso.
- `semantic.ts` — papéis (o que a UI realmente referencia), um conjunto por tema, apontando para primitivos.
- `themes.ts` — agrega e tipa.
- `css-vars.ts` e `tailwind-preset.cjs` — **derivados** do semântico (consumo), nunca fonte da verdade.

**Fluxo do dado:**

```
primitives.ts  →  semantic.ts  →  ┬→ tailwind-preset.cjs  (utilitários web)
(hex crus)        (papéis/tema)   ├→ css-vars.ts          (troca de tema :root/.dark)
                                  └→ themes.ts            (consumo direto p/ mobile futuro)
```

Mudar uma cor é **um lugar só** (`semantic.ts`); preset, CSS e mobile herdam.

---

## 4. Modelo de tokens

### 4.1 Primitivos

Paleta base (escala 50→900 onde aplicável). Identidade: azul-petróleo + verde-água, acento coral, neutros com leve tinta petróleo.

**Teal / petróleo (marca):**
`50 #ECF6F6 · 100 #CFE8E8 · 200 #9FD0D1 · 300 #6BB4B6 · 400 #3E9598 · 500 #1F7A7D · 600 #155E61 · 700 #0F4749 · 800 #0A3335 · 900 #062123`

**Aqua / verde-água (secundária, gráficos):**
`400 #4FD1C5 · 500 #2BB6A8`

**Coral (acento):**
`300 #FF9488 · 400 #FF7A6B · 500 #FF6B5A · 600 #E55444`

**Neutros (tinta petróleo):**
`0 #FFFFFF · 50 #F7F9F9 · 100 #EEF2F2 · 200 #DDE4E4 · 300 #C2CCCC · 400 #95A3A3 · 500 #6B7878 · 600 #4C5757 · 700 #364040 · 800 #222A2A · 900 #141A1A`

**Feedback (separados do acento):**
`success #1FA67A · success-light #3FBF93 (dark) · danger #E5484D · danger-light #F76A6E (dark) · warning #F5A623`
(os tons `-light` existem para manter contraste AA de valores sobre superfícies escuras.)

**Escalas não-cor:**

- **Espaçamento** (px, base 4): `0, 1=4, 2=8, 3=12, 4=16, 5=20, 6=24, 8=32, 10=40, 12=48, 16=64`.
- **Raio:** `sm 6 · md 10 · lg 16 · xl 24 · full 9999`.
- **Tipografia (tamanho/altura):** `xs 12/16 · sm 14/20 · base 16/24 · lg 18/28 · xl 20/28 · 2xl 24/32 · 3xl 30/36 · 4xl 36/40`. Pesos: `regular 400 · medium 500 · semibold 600 · bold 700`. Família: stack do sistema na v1 (`ui-sans-serif, system-ui, ...`) — fonte custom é decisão de app, fora do escopo.
- **Sombra:** `sm · md · lg` (offsets/blur suaves, baixo alpha — tom calmo).

### 4.2 Semânticos (papéis)

A UI referencia **sempre** o papel, nunca o primitivo. Conjunto idêntico de chaves em ambos os temas.

| Papel | Light | Dark |
|---|---|---|
| `bg.canvas` | neutral-50 `#F7F9F9` | neutral-900 `#141A1A` |
| `bg.surface` | neutral-0 `#FFFFFF` | `#1C2424` |
| `bg.subtle` | neutral-100 `#EEF2F2` | neutral-800 `#222A2A` |
| `border` | neutral-200 `#DDE4E4` | neutral-700 `#364040` |
| `text.primary` | neutral-900 `#141A1A` | neutral-50 `#F7F9F9` |
| `text.muted` | neutral-500 `#6B7878` | neutral-400 `#95A3A3` |
| `text.onAccent` | `#FFFFFF` | `#FFFFFF` |
| `brand` | teal-500 `#1F7A7D` | teal-300 `#6BB4B6` |
| `accent` | coral-500 `#FF6B5A` | coral-400 `#FF7A6B` |
| `accent.hover` | coral-600 `#E55444` | coral-500 `#FF6B5A` |
| `amount.positive` | success `#1FA67A` | `#3FBF93` |
| `amount.negative` | danger `#E5484D` | `#F76A6E` |
| `focusRing` | accent | accent |

> Nota: os tons dark de `amount.*` são clareados (`#3FBF93`, `#F76A6E`) para manter contraste AA sobre superfícies escuras.

### 4.3 Decisão de design: acento ≠ receita/despesa

Num app financeiro, vermelho e verde **carregam significado** (despesa/receita). Por isso o acento de marca (**coral**) é reservado a CTAs, realces e estado ativo — nunca usado para valores monetários. Receita usa `amount.positive` (verde), despesa usa `amount.negative` (vermelho). Assim "saldo" e "botão primário" nunca competem pela mesma cor, e o usuário lê o sinal do valor sem ambiguidade. Valores continuam em **centavos inteiros** (regra do projeto); a cor é só apresentação.

---

## 5. Mecanismo de tema e consumo

### 5.1 Preset Tailwind (web)

`apps/web` (futuro) terá um `tailwind.config` mínimo:

```js
module.exports = { darkMode: 'class', presets: [require('@lastro/ui/tailwind-preset')] }
```

O preset (`tailwind-preset.cjs`) mapeia papéis semânticos para utilitários via **variáveis CSS** (não hex fixos), além de espaçamento, raio, fonte e sombra vindos dos primitivos:

```js
theme: { extend: {
  colors: {
    canvas:  'var(--bg-canvas)',
    surface: 'var(--bg-surface)',
    subtle:  'var(--bg-subtle)',
    border:  'var(--border)',
    'text-primary': 'var(--text-primary)',
    'text-muted':   'var(--text-muted)',
    brand:   'var(--brand)',
    accent:  'var(--accent)',
    'amount-positive': 'var(--amount-positive)',
    'amount-negative': 'var(--amount-negative)',
  },
  borderRadius: { /* de primitives.radius */ },
  spacing:      { /* de primitives.space  */ },
  boxShadow:    { /* de primitives.shadow */ },
}}
```

### 5.2 Variáveis CSS e troca de tema

`css-vars.ts` exporta uma função/string que gera, a partir do semântico, os dois blocos:

```css
:root { --bg-surface:#FFFFFF; --text-primary:#141A1A; --accent:#FF6B5A; /* ... */ }
.dark { --bg-surface:#1C2424; --text-primary:#F7F9F9; --accent:#FF7A6B; /* ... */ }
```

O app injeta esse CSS uma vez (ex.: em `index.css`/`<head>`). Alternar tema = adicionar/remover a classe `.dark` no `<html>`. Como cada utilitário aponta para `var(--…)`, **toda a UI troca de tema sem recompilar nem reescrever classes**.

### 5.3 Mobile (futuro, fora do escopo da v1)

`apps/mobile` importa `themes.ts` diretamente (`theme.light` / `theme.dark`) e alimenta o NativeWind/StyleSheet com os mesmos valores — sem CSS, mesma fonte da verdade.

---

## 6. Testes (Vitest)

Mantendo a regra do projeto "contrato/lógica nasce com teste". Não há componentes a renderizar — os testes cobrem o que pode quebrar de verdade em dados:

1. **Contraste WCAG AA** (`contrast.test.ts`):
   - `contrast.ts` implementa a razão de contraste por luminância relativa (fórmula WCAG 2.1).
   - O teste exige **≥ 4.5:1** (texto normal) para os pares: `text.primary` e `text.muted` sobre `bg.surface`, `bg.canvas` e `bg.subtle`; e `text.onAccent` sobre `accent` — **nos dois temas**.
   - Componentes monetários: `amount.positive`/`amount.negative` sobre `bg.surface` exigem ≥ 3:1 (texto grande/realce). Pega regressão de cor que machuca acessibilidade.

2. **Integridade de tokens** (`tokens.test.ts`):
   - Todo papel semântico (light e dark) resolve para um hex válido (`#RRGGBB`).
   - `light` e `dark` têm **exatamente o mesmo conjunto de chaves** (nenhum papel faltando num tema).
   - Toda chave referenciada pelo preset/css-vars existe no semântico (sem variável órfã).

---

## 7. Critérios de aceite

- [ ] `@lastro/ui` existe em `packages/ui`, no padrão TS-puro do monorepo, instalável via `workspace:*`.
- [ ] `pnpm lint`, `pnpm typecheck` e `pnpm test` passam para o pacote (e no agregado do monorepo).
- [ ] Tokens primitivos e semânticos exportados; temas `light` e `dark` completos e tipados.
- [ ] `tailwind-preset.cjs` consumível por um `tailwind.config` (validado por um teste/checagem de shape).
- [ ] Testes de contraste (AA) e de integridade passam, cobrindo ambos os temas.
- [ ] Nenhum valor de cor duplicado entre `semantic` e os derivados (preset/css-vars derivam do semântico).

---

## 8. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Cor escolhida falha contraste AA | Teste de contraste no CI; ajustar o tom no `semantic.ts` (um lugar) |
| Token semântico divergir entre temas | Teste de paridade de chaves light/dark |
| Preset Tailwind sair de sincronia com tokens | Preset e css-vars são **gerados** do semântico, não escritos à mão |
| Acoplar UI entre web e mobile cedo demais | Escopo v1 é tokens-only; componentes ficam nos apps |
| Acento competir com receita/despesa | Separação explícita: coral só para acento; verde/vermelho para valores |

---

## 9. Ferramentas de apoio (implementação)

- **`frontend-design`** (skill): valida a direção estética na hora de montar os componentes nos apps.
- **MCP `magic` (21st.dev)**: gera/refina componentes concretos dentro destes tokens, já em `apps/web`.
- **`context7`**: confirma APIs atuais de Tailwind, Vite, Recharts e TanStack na integração.

Estes apoiam as fases **seguintes** (apps); a v1 do `packages/ui` é dado puro + testes.
