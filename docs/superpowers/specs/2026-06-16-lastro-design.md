# Lastro — Documento de Design (v1)

> **Lastro — equilíbrio pras suas finanças.**
> App de controle de gastos pessoais com importação de extratos bancários,
> categorização automática e dashboard visual. Android + Web.

- **Data:** 2026-06-16
- **Autor:** Guilherme (com Claude)
- **Status:** Aprovação pendente
- **Repositório:** https://github.com/EpicFailDev/lastro

---

## 1. Propósito e princípios

O Lastro resolve um problema concreto: **entender pra onde o dinheiro vai, sem a dor
de registrar tudo na mão.** O usuário exporta o extrato do banco, o app importa,
categoriza automaticamente e mostra um dashboard agradável e fácil de entender.

Princípios de produto:

1. **Baixa fricção** — registrar gasto é o ponto onde apps financeiros morrem. Importar
   extrato e aprender com correções minimiza esse atrito.
2. **Calma e confiança** — dinheiro gera ansiedade; o app deve acalmar, não estressar.
3. **Privacidade por design** — dados sensíveis, tratados com cuidado desde o dia 1.
4. **Pequeno e afiado** — nasce como produto público, mas o v1 faz o essencial muito bem.

Público-alvo: produto público desde o início, com possibilidade de monetização futura.

---

## 2. Decisões de stack (cravadas)

| Camada | Escolha | Por quê |
|---|---|---|
| Banco + Auth | **Supabase** (Postgres + Auth + RLS) | Postgres real, auth pronto, RLS por usuário, free tier |
| Mobile | **React Native + Expo** (Expo Router) | Android nativo, ecossistema JS/TS |
| Web | **React + Vite** (React Router) | SPA rápida, build simples |
| Linguagem | **TypeScript** (strict) | Segurança de tipos em todo o monorepo |
| Monorepo | **pnpm workspaces + Turborepo** | Rápido, cache no CI, padrão de mercado |
| Estilo | **Tailwind (web) + NativeWind (mobile)** | Mesma linguagem de estilo nos dois |
| Estado servidor | **TanStack Query** | Cache, loading e sync com Supabase |
| Formulários | **React Hook Form + Zod** | Validação robusta, pouca cerimônia |
| Validação/tipos | **Zod** | Fonte única: valida dado e gera tipo TS |
| Gráficos | **Recharts** (web) / **Victory Native** (mobile) | Maduros em cada plataforma |
| CSV | **PapaParse** | Parser de CSV robusto |
| Testes | **Vitest** + Testing Library | Rápido, integra com o monorepo |
| Lint/format | **ESLint + Prettier** | Padrão |
| CI/CD | **GitHub Actions** | Lint + testes por push; preview da web |

---

## 3. Arquitetura — estrutura do monorepo

```
lastro/
├── apps/
│   ├── mobile/        # React Native (Expo) — Android
│   └── web/           # React (Vite) — site
├── packages/
│   ├── shared/        # tipos (Zod), lógica de negócio, cliente Supabase
│   ├── importers/     # parsers de extrato (OFX, CSV, modelos de banco)
│   ├── categorizer/   # motor de categorização (regras + aprendizado)
│   └── ui/            # tokens de design e componentes compartilháveis
├── supabase/          # migrations SQL, políticas RLS, seeds
└── .github/workflows/ # CI/CD
```

**Princípio de isolamento:** a lógica difícil (importar e categorizar) vive em `packages/`
sem nenhuma dependência de UI. É testável isoladamente e reaproveitada no Android e na
web sem duplicação. Cada pacote tem um propósito único e interface bem definida.

---

## 4. Modelo de dados (Postgres / Supabase)

Todas as tabelas com **Row Level Security**: cada usuário só acessa as próprias linhas
(`user_id = auth.uid()`).

| Tabela | Campos-chave | Propósito |
|---|---|---|
| `profiles` | `id` (→ auth.users), `display_name`, `created_at` | Dados do usuário |
| `accounts` | `id`, `user_id`, `name`, `type`, `institution`, `archived` | Contas/carteiras (Nubank, Mercado Pago…) |
| `categories` | `id`, `user_id` (null = padrão do sistema), `name`, `icon`, `color`, `kind` | Categorias (padrão + do usuário) |
| `transactions` | `id`, `user_id`, `account_id`, `category_id`, `amount_cents`, `currency`, `description`, `occurred_at`, `import_id`, `dedup_hash`, `is_manual` | Os gastos/receitas — coração do app |
| `category_rules` | `id`, `user_id`, `match_type`, `pattern`, `category_id`, `weight` | Regras aprendidas ("Padaria do Zé" → Alimentação) |
| `imports` | `id`, `user_id`, `account_id`, `source_format`, `file_name`, `row_count`, `created_at` | Histórico de importações (auditar/desfazer) |

Decisões de modelagem (sênior):

- **`amount_cents` é `integer`** (centavos). Nunca `float`/`money` — evita erro de ponto
  flutuante. Valor negativo = despesa, positivo = receita.
- **`occurred_at` em `timestamptz` (UTC)** — exibição converte pro fuso local. Evita bugs
  de fuso.
- **`dedup_hash`** = hash de `(account_id, occurred_at::date, amount_cents, description)`.
  Único por usuário+conta. Impede importar a mesma transação duas vezes.
- **`category_id` pode ser null** (não categorizada) — o usuário resolve na revisão.
- IDs são **UUID**.

---

## 5. Fluxo principal (o ciclo do coração)

```
Selecionar conta → enviar arquivo (OFX/CSV)
   → [importers] detecta formato e extrai transações  (no dispositivo)
   → [categorizer] sugere categoria (regras → aprendizado)
   → Tela de REVISÃO: usuário confere e corrige
        ↳ correções viram novas category_rules
   → Confirma → grava no Supabase (pulando dedup_hash repetidos)
   → Dashboard atualiza
```

Lançamento manual entra direto no passo de gravação. **O parsing acontece no
dispositivo** — o arquivo do banco nunca sobe pro servidor, só as transações já tratadas.

### 5.1 Estratégia de importação (híbrida)

1. **OFX nativo** — formato padronizado que vários bancos suportam; um parser cobre muitos.
2. **Modelos por banco** — mapeamentos prontos pros CSVs do Nubank e Mercado Pago (foco BR).
3. **Assistente genérico de CSV** — usuário mapeia colunas (data, valor, descrição) uma vez;
   o mapeamento é salvo. Rede de segurança pro resto.

### 5.2 Estratégia de categorização (regras + aprendizado)

1. Regras-semente por palavra-chave (iFood→Alimentação, Uber→Transporte…).
2. Quando o usuário corrige uma categoria, cria/reforça uma `category_rule`.
3. Importações futuras usam as regras aprendidas. Zero custo de IA.

---

## 6. Telas (v1)

- **Login/Onboarding** — Supabase Auth (email/senha + Google).
- **Dashboard** — total do mês, gráfico por categoria, evolução mensal, maiores gastos.
- **Transações** — lista filtrável (conta, categoria, período), busca, editar categoria.
- **Importar** — upload + tela de revisão.
- **Adicionar gasto** — formulário manual rápido.
- **Contas** — gerenciar carteiras.
- **Ajustes** — perfil, categorias, exportar dados, apagar conta (LGPD).

---

## 7. Identidade visual

- **Tom:** calmo, confiável, sem poluição.
- **Cor base:** azul-petróleo / verde-água (mar, estabilidade — combina com "Lastro"),
  com um acento quente pra destaques.
- **Gráficos:** poucos, grandes, claros.
- **Temas claro e escuro** desde o v1.
- A implementação visual usará a skill `frontend-design` para qualidade de produção.

---

## 8. Segurança, privacidade e qualidade

- **RLS** em todas as tabelas; isolamento por usuário garantido no banco.
- **Parsing client-side** — extrato bruto não trafega nem é armazenado.
- **Segredos** fora do git (`.env`; já no `.gitignore`). Chaves do Supabase via env.
- **LGPD:** exportar dados + apagar conta no v1; política de privacidade antes do público.
- **Testes:** `importers` e `categorizer` nascem com testes (lógica crítica).
- **CI/CD (GitHub Actions):** lint + typecheck + testes por push; build/preview da web.

---

## 9. Fora de escopo do v1 (consciente)

Orçamento/limites · automação bancária (Open Finance) · iOS · multi-moeda · relatórios PDF ·
metas de economia · compartilhamento familiar · notificações push.

Esses são candidatos a v2+. O v1 entrega o ciclo central com excelência.

---

## 10. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Formatos de banco mudam/variam | Estratégia híbrida + assistente genérico de CSV |
| Importação duplicada | `dedup_hash` único |
| Erro de arredondamento financeiro | Centavos inteiros, nunca float |
| Vazamento entre usuários | RLS testado; parsing client-side |
| Escopo inchar | Lista explícita de "fora do v1" |
| Free tier do Supabase dormir | Irrelevante em dev; avaliar plano pago ao crescer |
