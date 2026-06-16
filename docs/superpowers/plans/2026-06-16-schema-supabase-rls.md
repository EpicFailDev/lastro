# Schema Supabase + RLS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Definir o schema do banco do Lastro (tabelas, constraints, RLS por usuário e categorias-semente) como migrations versionadas do Supabase, com testes pgTAP que provam o isolamento entre usuários, tudo rodando no CI.

**Architecture:** Supabase CLI como devDependency do monorepo. As migrations SQL em `supabase/migrations/` são a fonte de verdade do schema. RLS é habilitado em todas as tabelas e testado com pgTAP em `supabase/tests/`. O ambiente local sobe via Docker (`supabase start`); o CI sobe o mesmo stack e roda `supabase db test`.

**Tech Stack:** Supabase CLI, PostgreSQL, Row Level Security, pgTAP, GitHub Actions, Docker.

**Pré-requisitos do ambiente:**
- **Docker Desktop rodando** (necessário para `supabase start` / `supabase db test` local).
- pnpm no PATH: `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm"`.
- Uma conta no Supabase só será necessária no deploy (Plano posterior). Este plano roda 100% local.

---

## Estrutura de arquivos (criada por este plano)

```
lastro/
├── package.json                 # + supabase como devDependency
├── supabase/
│   ├── config.toml              # gerado por `supabase init`
│   ├── migrations/
│   │   ├── 0001_extensions.sql       # extensões (pgcrypto)
│   │   ├── 0002_profiles.sql         # profiles + trigger de criação
│   │   ├── 0003_accounts.sql         # contas/carteiras
│   │   ├── 0004_categories.sql       # categorias (sistema + usuário)
│   │   ├── 0005_imports.sql          # histórico de importações
│   │   ├── 0006_transactions.sql     # transações + dedup
│   │   ├── 0007_category_rules.sql   # regras de categorização
│   │   ├── 0008_rls.sql              # políticas RLS de todas as tabelas
│   │   └── 0009_seed_categories.sql  # categorias-semente do sistema
│   └── tests/
│       ├── 00_schema.test.sql        # tabelas existem, RLS habilitado
│       ├── 01_dedup.test.sql         # constraint de deduplicação
│       └── 02_rls_isolation.test.sql # usuário A não vê dados do usuário B
└── .github/workflows/db.yml     # job de CI: supabase db test
```

> **Convenção de dinheiro/tempo (do design):** `amount_cents` é `integer` (centavos;
> negativo = despesa); datas em `timestamptz` (UTC). IDs são `uuid` via `gen_random_uuid()`.

---

### Task 1: Adicionar Supabase CLI e inicializar

**Files:**
- Modify: `package.json` (adiciona devDependency + scripts)
- Create: `supabase/config.toml` (via `supabase init`)

- [ ] **Step 1: Adicionar o CLI como devDependency**

Run: `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm" && pnpm add -Dw supabase`
Expected: `supabase` aparece em `devDependencies` do `package.json` raiz; lockfile atualizado.

- [ ] **Step 2: Inicializar o Supabase**

Run: `pnpm supabase init`
Expected: cria `supabase/config.toml` e a pasta `supabase/`. Se perguntar sobre VS Code
settings/Deno, responda `N`.

- [ ] **Step 3: Adicionar scripts de banco ao package.json raiz**

Adicione ao bloco `"scripts"` do `package.json` raiz:

```json
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:test": "supabase test db"
```

- [ ] **Step 4: Subir o stack local (valida Docker + CLI)**

Run: `pnpm db:start`
Expected: baixa imagens na 1ª vez e imprime as URLs locais (API URL, DB URL, Studio URL,
`anon key`, `service_role key`). Se falhar com erro de Docker, abra o Docker Desktop e repita.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml supabase/config.toml
git commit -m "chore(db): adiciona supabase cli e inicializa projeto local"
```

---

### Task 2: Extensões e tabela `profiles`

**Files:**
- Create: `supabase/migrations/0001_extensions.sql`
- Create: `supabase/migrations/0002_profiles.sql`

- [ ] **Step 1: Migration de extensões**

`supabase/migrations/0001_extensions.sql`:

```sql
-- pgcrypto fornece gen_random_uuid()
create extension if not exists pgcrypto;
```

- [ ] **Step 2: Migration de profiles + trigger**

`supabase/migrations/0002_profiles.sql`:

```sql
-- Perfil do usuário, espelhando auth.users (1:1).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- Cria um profile automaticamente quando um usuário se cadastra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 3: Aplicar e validar**

Run: `pnpm db:reset`
Expected: aplica todas as migrations sem erro ("Applying migration 0001...", "0002...").

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_extensions.sql supabase/migrations/0002_profiles.sql
git commit -m "feat(db): extensoes e tabela profiles com trigger de criacao"
```

---

### Task 3: Tabela `accounts`

**Files:**
- Create: `supabase/migrations/0003_accounts.sql`

- [ ] **Step 1: Migration de accounts**

`supabase/migrations/0003_accounts.sql`:

```sql
-- Contas/carteiras do usuário (Nubank, Mercado Pago, dinheiro...).
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null default 'wallet',        -- wallet | checking | credit_card
  institution text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index accounts_user_id_idx on public.accounts (user_id);
```

- [ ] **Step 2: Aplicar e validar**

Run: `pnpm db:reset`
Expected: aplica até a migration 0003 sem erro.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_accounts.sql
git commit -m "feat(db): tabela accounts"
```

---

### Task 4: Tabela `categories`

**Files:**
- Create: `supabase/migrations/0004_categories.sql`

- [ ] **Step 1: Migration de categories**

`supabase/migrations/0004_categories.sql`:

```sql
-- Categorias. user_id NULL = categoria padrão do sistema (visível a todos, somente leitura).
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  icon text,
  color text,
  kind text not null default 'expense'         -- expense | income | both
    check (kind in ('expense', 'income', 'both')),
  created_at timestamptz not null default now()
);

create index categories_user_id_idx on public.categories (user_id);
```

- [ ] **Step 2: Aplicar e validar**

Run: `pnpm db:reset`
Expected: aplica até 0004 sem erro.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0004_categories.sql
git commit -m "feat(db): tabela categories (sistema + usuario)"
```

---

### Task 5: Tabela `imports`

**Files:**
- Create: `supabase/migrations/0005_imports.sql`

- [ ] **Step 1: Migration de imports**

`supabase/migrations/0005_imports.sql`:

```sql
-- Histórico de cada arquivo de extrato importado (auditoria / desfazer).
create table public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  source_format text not null,                 -- ofx | csv
  file_name text,
  row_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index imports_user_id_idx on public.imports (user_id);
```

- [ ] **Step 2: Aplicar e validar**

Run: `pnpm db:reset`
Expected: aplica até 0005 sem erro.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0005_imports.sql
git commit -m "feat(db): tabela imports"
```

---

### Task 6: Tabela `transactions` (com dedup)

**Files:**
- Create: `supabase/migrations/0006_transactions.sql`

- [ ] **Step 1: Migration de transactions**

`supabase/migrations/0006_transactions.sql`:

```sql
-- Transações: o coração do app. amount_cents negativo = despesa, positivo = receita.
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  amount_cents integer not null,
  currency text not null default 'BRL',
  description text,
  occurred_at timestamptz not null,
  import_id uuid references public.imports (id) on delete set null,
  dedup_hash text not null,
  is_manual boolean not null default false,
  created_at timestamptz not null default now(),
  -- Impede importar a mesma transação duas vezes para o mesmo usuário.
  constraint transactions_user_dedup_unique unique (user_id, dedup_hash)
);

create index transactions_user_id_idx on public.transactions (user_id);
create index transactions_account_id_idx on public.transactions (account_id);
create index transactions_occurred_at_idx on public.transactions (occurred_at);
```

- [ ] **Step 2: Aplicar e validar**

Run: `pnpm db:reset`
Expected: aplica até 0006 sem erro.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0006_transactions.sql
git commit -m "feat(db): tabela transactions com constraint de deduplicacao"
```

---

### Task 7: Tabela `category_rules`

**Files:**
- Create: `supabase/migrations/0007_category_rules.sql`

- [ ] **Step 1: Migration de category_rules**

`supabase/migrations/0007_category_rules.sql`:

```sql
-- Regras de categorização aprendidas ("contém 'iFood'" -> Alimentação).
create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  match_type text not null default 'contains'  -- contains | equals | regex
    check (match_type in ('contains', 'equals', 'regex')),
  pattern text not null,
  category_id uuid not null references public.categories (id) on delete cascade,
  weight integer not null default 1,
  created_at timestamptz not null default now()
);

create index category_rules_user_id_idx on public.category_rules (user_id);
```

- [ ] **Step 2: Aplicar e validar**

Run: `pnpm db:reset`
Expected: aplica até 0007 sem erro.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0007_category_rules.sql
git commit -m "feat(db): tabela category_rules"
```

---

### Task 8: Row Level Security em todas as tabelas

**Files:**
- Create: `supabase/migrations/0008_rls.sql`

- [ ] **Step 1: Migration de RLS**

`supabase/migrations/0008_rls.sql`:

```sql
-- Habilita RLS em tudo.
alter table public.profiles       enable row level security;
alter table public.accounts       enable row level security;
alter table public.categories     enable row level security;
alter table public.imports        enable row level security;
alter table public.transactions   enable row level security;
alter table public.category_rules enable row level security;

-- profiles: o usuário lê e atualiza apenas o próprio.
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

-- accounts: CRUD apenas dos próprios registros.
create policy "accounts_all_own" on public.accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- categories: lê as próprias E as do sistema (user_id null); modifica só as próprias.
create policy "categories_select_own_or_system" on public.categories
  for select using (user_id = auth.uid() or user_id is null);
create policy "categories_insert_own" on public.categories
  for insert with check (user_id = auth.uid());
create policy "categories_update_own" on public.categories
  for update using (user_id = auth.uid());
create policy "categories_delete_own" on public.categories
  for delete using (user_id = auth.uid());

-- imports: CRUD apenas dos próprios.
create policy "imports_all_own" on public.imports
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- transactions: CRUD apenas das próprias.
create policy "transactions_all_own" on public.transactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- category_rules: CRUD apenas das próprias.
create policy "category_rules_all_own" on public.category_rules
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

- [ ] **Step 2: Aplicar e validar**

Run: `pnpm db:reset`
Expected: aplica até 0008 sem erro.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_rls.sql
git commit -m "feat(db): politicas RLS por usuario em todas as tabelas"
```

---

### Task 9: Categorias-semente do sistema

**Files:**
- Create: `supabase/migrations/0009_seed_categories.sql`

- [ ] **Step 1: Migration de seed**

`supabase/migrations/0009_seed_categories.sql`:

```sql
-- Categorias padrão do sistema (user_id null). Idempotente via name+null.
insert into public.categories (user_id, name, icon, color, kind) values
  (null, 'Alimentação', 'utensils',   '#E76F51', 'expense'),
  (null, 'Transporte',  'car',        '#2A9D8F', 'expense'),
  (null, 'Moradia',     'home',       '#264653', 'expense'),
  (null, 'Saúde',       'heart',      '#E63946', 'expense'),
  (null, 'Lazer',       'gamepad',    '#F4A261', 'expense'),
  (null, 'Educação',    'book',       '#457B9D', 'expense'),
  (null, 'Compras',     'shopping-bag','#A8DADC', 'expense'),
  (null, 'Contas',      'file-text',  '#6D6875', 'expense'),
  (null, 'Renda',       'trending-up','#52B788', 'income'),
  (null, 'Outros',      'circle',     '#8D99AE', 'both');
```

- [ ] **Step 2: Aplicar e validar**

Run: `pnpm db:reset`
Expected: aplica até 0009; as 10 categorias são inseridas.

- [ ] **Step 3: Conferir manualmente**

Run: `pnpm supabase db query "select count(*) from public.categories where user_id is null;"`
Expected: retorna `10`.
(Se o subcomando `db query` não existir nesta versão do CLI, use:
`docker exec -i supabase_db_lastro psql -U postgres -c "select count(*) from public.categories where user_id is null;"`.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0009_seed_categories.sql
git commit -m "feat(db): categorias-semente do sistema"
```

---

### Task 10: Testes pgTAP — schema e RLS habilitado

**Files:**
- Create: `supabase/tests/00_schema.test.sql`

- [ ] **Step 1: Escrever o teste de schema**

`supabase/tests/00_schema.test.sql`:

```sql
begin;
select plan(13);

-- Tabelas existem.
select has_table('public', 'profiles', 'profiles existe');
select has_table('public', 'accounts', 'accounts existe');
select has_table('public', 'categories', 'categories existe');
select has_table('public', 'imports', 'imports existe');
select has_table('public', 'transactions', 'transactions existe');
select has_table('public', 'category_rules', 'category_rules existe');

-- RLS habilitado em todas.
select results_eq(
  $$ select relname::text from pg_class
     where relnamespace = 'public'::regnamespace
       and relkind = 'r' and relrowsecurity = true
     order by relname $$,
  $$ values ('accounts'),('categories'),('category_rules'),
            ('imports'),('profiles'),('transactions') $$,
  'RLS habilitado em todas as tabelas'
);

-- Seed do sistema.
select is(
  (select count(*)::int from public.categories where user_id is null),
  10, 'existem 10 categorias do sistema'
);

-- Colunas críticas com o tipo certo.
select col_type_is('public', 'transactions', 'amount_cents', 'integer',
  'amount_cents é integer (centavos)');
select col_type_is('public', 'transactions', 'occurred_at', 'timestamp with time zone',
  'occurred_at é timestamptz (UTC)');
select col_type_is('public', 'transactions', 'id', 'uuid', 'id é uuid');
select col_type_is('public', 'accounts', 'id', 'uuid', 'accounts.id é uuid');

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar o teste**

Run: `pnpm db:test`
Expected: `00_schema.test.sql .. ok` — 13 testes passando.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/00_schema.test.sql
git commit -m "test(db): schema e RLS habilitado (pgTAP)"
```

---

### Task 11: Teste pgTAP — deduplicação

**Files:**
- Create: `supabase/tests/01_dedup.test.sql`

- [ ] **Step 1: Escrever o teste de dedup**

`supabase/tests/01_dedup.test.sql`:

```sql
begin;
select plan(2);

-- Cria um usuário e uma conta de teste (contornando RLS como superuser do teste).
insert into auth.users (id, email)
  values ('00000000-0000-0000-0000-000000000001', 'dedup@test.com');
insert into public.accounts (id, user_id, name)
  values ('00000000-0000-0000-0000-0000000000a1',
          '00000000-0000-0000-0000-000000000001', 'Conta Teste');

-- Primeira inserção com um dedup_hash funciona.
select lives_ok(
  $$ insert into public.transactions
       (user_id, account_id, amount_cents, occurred_at, dedup_hash)
     values ('00000000-0000-0000-0000-000000000001',
             '00000000-0000-0000-0000-0000000000a1',
             -1500, now(), 'hash-abc') $$,
  'primeira transação com hash-abc é aceita'
);

-- Segunda inserção com o MESMO (user_id, dedup_hash) é rejeitada.
select throws_ok(
  $$ insert into public.transactions
       (user_id, account_id, amount_cents, occurred_at, dedup_hash)
     values ('00000000-0000-0000-0000-000000000001',
             '00000000-0000-0000-0000-0000000000a1',
             -1500, now(), 'hash-abc') $$,
  '23505',  -- unique_violation
  null,
  'transação duplicada (mesmo hash) é rejeitada'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar os testes**

Run: `pnpm db:test`
Expected: `01_dedup.test.sql .. ok` — 2 testes passando (e o 00 continua ok).

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/01_dedup.test.sql
git commit -m "test(db): deduplicacao de transacoes (pgTAP)"
```

---

### Task 12: Teste pgTAP — isolamento RLS entre usuários

**Files:**
- Create: `supabase/tests/02_rls_isolation.test.sql`

- [ ] **Step 1: Escrever o teste de isolamento**

`supabase/tests/02_rls_isolation.test.sql`:

```sql
begin;
select plan(2);

-- Dois usuários.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000aa', 'alice@test.com'),
  ('00000000-0000-0000-0000-0000000000bb', 'bob@test.com');

-- Conta + transação da Alice (inseridas como superuser do teste).
insert into public.accounts (id, user_id, name)
  values ('00000000-0000-0000-0000-0000000000a2',
          '00000000-0000-0000-0000-0000000000aa', 'Conta Alice');
insert into public.transactions
  (user_id, account_id, amount_cents, occurred_at, dedup_hash)
  values ('00000000-0000-0000-0000-0000000000aa',
          '00000000-0000-0000-0000-0000000000a2',
          -999, now(), 'alice-1');

-- Vira a Alice (role authenticated + JWT com sub = id da Alice): vê 1 transação.
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-0000000000aa","role":"authenticated"}';
select is(
  (select count(*)::int from public.transactions),
  1, 'Alice vê a própria transação'
);

-- Vira o Bob: NÃO vê nenhuma transação da Alice.
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-0000000000bb","role":"authenticated"}';
select is(
  (select count(*)::int from public.transactions),
  0, 'Bob não vê transações da Alice (RLS isola)'
);

reset role;
select * from finish();
rollback;
```

- [ ] **Step 2: Rodar os testes**

Run: `pnpm db:test`
Expected: `02_rls_isolation.test.sql .. ok` — 2 testes passando. Os 3 arquivos de teste passam.

> Se o `set local role authenticated` falhar por a role não existir no contexto de teste,
> ajuste para `set local role to authenticated;` ou confirme que o stack local do Supabase
> criou a role `authenticated` (ele cria por padrão). Não prossiga sem este teste verde — é
> a prova de segurança central do app.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/02_rls_isolation.test.sql
git commit -m "test(db): isolamento RLS entre usuarios (pgTAP)"
```

---

### Task 13: CI — rodar os testes de banco

**Files:**
- Create: `.github/workflows/db.yml`

- [ ] **Step 1: Criar o workflow de banco**

`.github/workflows/db.yml`:

```yaml
name: DB

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  db-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Start Supabase
        run: pnpm supabase start

      - name: Run database tests
        run: pnpm supabase test db

      - name: Stop Supabase
        if: always()
        run: pnpm supabase stop
```

- [ ] **Step 2: Validar o YAML localmente**

Run: `pnpm exec prettier --check .github/workflows/db.yml`
Expected: PASS (ou rode `pnpm exec prettier --write .github/workflows/db.yml`).

- [ ] **Step 3: Commit e push da branch**

```bash
git add .github/workflows/db.yml
git commit -m "ci: roda testes de banco (supabase test db) no github actions"
git push -u origin feat/schema-supabase
```

- [ ] **Step 4: Abrir PR e confirmar CI verde**

```bash
gh pr create --base main --head feat/schema-supabase \
  --title "feat(db): schema do Supabase + RLS + testes pgTAP" \
  --body "Schema completo (tabelas, dedup, RLS por usuário, seed) com testes pgTAP rodando no CI."
```
Run: `gh run watch <run-id> --exit-status`
Expected: workflows `CI` e `DB` verdes.

---

## Self-Review (feita ao escrever)

- **Cobertura do design (seção 4):** todas as 6 tabelas (`profiles`, `accounts`, `categories`,
  `transactions`, `category_rules`, `imports`) ✓; `amount_cents` integer ✓; `occurred_at`
  timestamptz/UTC ✓; `dedup_hash` único por usuário ✓; `category_id` nullable ✓; UUIDs ✓;
  RLS por usuário ✓; categorias-semente ✓ (seção 8 segurança).
- **Placeholders:** nenhum TODO/TBD; todo passo tem SQL/comando concreto.
- **Consistência de nomes:** nomes de tabelas/colunas idênticos entre migrations, seed e
  testes (`amount_cents`, `dedup_hash`, `occurred_at`, `user_id`). Ordem de FKs respeitada
  (accounts→imports→transactions). Scripts (`db:start/reset/test`) batem entre `package.json`,
  passos e CI.

## Definition of Done

- `pnpm db:reset` aplica as 9 migrations sem erro.
- `pnpm db:test` verde (schema, dedup e isolamento RLS).
- Workflows `CI` e `DB` verdes no PR.
- Schema pronto para o Plano 5 (`shared`/queries) consumir.
