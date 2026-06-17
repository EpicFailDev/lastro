# Evolução do schema — aprendizados da comunidade

> **Status:** RASCUNHO — pendente de revisão antes de executar. Deriva de
> [`notas/2026-06-16-aprendizados-da-comunidade.md`](../notas/2026-06-16-aprendizados-da-comunidade.md).
> **For agentic workers:** ao executar, use `superpowers:subagent-driven-development` ou
> `superpowers:executing-plans`. Passos com `- [ ]`.

**Goal:** Evoluir o schema da `main` (migrations `0001–0010`, já mergeadas) para incorporar os padrões
de robustez extraídos do Actual, Maybe e Firefly: dedup por ID externo, descrição crua do banco,
transferência como tipo de 1ª classe, perfis de import por conta e saldos diários materializados.
Tudo como **novas migrations aditivas** (`0011+`), sem reescrever o que já está na `main`, com testes
pgTAP provando cada garantia.

**Architecture:** migrations SQL aditivas em `supabase/migrations/`; testes pgTAP em `supabase/tests/`;
validação local com `pnpm db:reset` + `pnpm db:test`; CI roda `supabase test db`. Não altera RLS
existente (políticas `*_all_own` já cobrem colunas novas das mesmas tabelas).

**Pré-requisitos:** Docker Desktop rodando; `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm"`.

> **Escopo:** este plano cobre apenas a **camada de dados** (migrations + testes). A lógica que
> consome essas colunas (dedup em camadas no `importers`, motor de regras no `categorizer`, helper
> `Trend` e agregados no dashboard) entra nos Planos 5–7 e na evolução dos pacotes. O motor de regras
> (`rules`/`rule_conditions`/`rule_actions`) é deliberadamente deixado para o **Categorizer v2** —
> ver "Fora de escopo" no fim.

---

### Task 1: `imported_id` + `imported_description` em `transactions`

Captura o `FITID` do OFX (chave de dedup estável) e preserva a descrição crua do banco.

**Files:** Create `supabase/migrations/0011_transactions_imported_fields.sql`

- [ ] **Step 1: Migration**

```sql
-- Campos de proveniência da importação.
-- imported_id: identificador estável do banco (FITID do OFX). Melhor chave de dedup que existe.
-- imported_description: texto cru do banco, preservado mesmo quando a descrição é normalizada/renomeada.
alter table public.transactions
  add column imported_id text,
  add column imported_description text;

-- Dedup forte por ID externo: um FITID nunca se repete dentro da mesma conta.
-- Índice parcial: só vale quando há FITID (CSV sem FITID cai no dedup_hash/fuzzy da aplicação).
create unique index transactions_account_imported_id_uniq
  on public.transactions (account_id, imported_id)
  where imported_id is not null;
```

- [ ] **Step 2: Aplicar** — `pnpm db:reset` (aplica até 0011 sem erro).
- [ ] **Step 3: Commit** — `feat(db): imported_id (FITID) e imported_description em transactions`

> **Nota de design:** o `dedup_hash` atual (migration 0006) **continua existindo** como camada de
> fallback para CSV sem FITID. A regra recomendada (ver nota): hashear `amountCents + descrição
> normalizada` (sem a data) e tratar data por janela na aplicação. Mudar o conteúdo do hash é
> alteração no pacote `importers`, não aqui.

---

### Task 2: Transferência como tipo de 1ª classe

Marca pares de transações entre contas próprias como transferência interna — excluída de
relatórios de receita/despesa. Captura ~95% do benefício de partida dobrada com ~10% do custo.

**Files:** Create `supabase/migrations/0012_transactions_transfer.sql`

- [ ] **Step 1: Migration**

```sql
-- type: classifica a transação para os relatórios. 'transfer' é excluída de receita/despesa.
alter table public.transactions
  add column type text not null default 'expense'
    check (type in ('expense', 'income', 'transfer')),
  -- transfer_id: liga as duas pernas de uma transferência (mesma uuid nas duas linhas).
  add column transfer_id uuid;

create index transactions_transfer_id_idx
  on public.transactions (transfer_id) where transfer_id is not null;

-- Backfill coerente com a convenção de sinal (negativo = despesa, positivo = receita).
update public.transactions set type = 'income'  where amount_cents > 0;
update public.transactions set type = 'expense' where amount_cents <= 0;
```

- [ ] **Step 2: Aplicar** — `pnpm db:reset`.
- [ ] **Step 3: Commit** — `feat(db): type e transfer_id (transferencia como tipo de 1a classe)`

---

### Task 3: Perfis de import por conta

Persiste o mapeamento de import (delimiter, colunas, formato de data, regra de sinal) por conta —
"configura uma vez, repete sempre". Padrão do Actual e do Firefly.

**Files:** Create `supabase/migrations/0013_import_profiles.sql`

- [ ] **Step 1: Migration**

```sql
-- Perfil de importação salvo por conta. config jsonb guarda: delimiter, mapeamento coluna->papel,
-- formato de data, regra de sinal (flip/multiplier), etc. (formato evolui sem migration).
create table public.import_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  source_format text not null,                 -- ofx | csv
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, source_format)
);

create index import_profiles_user_id_idx on public.import_profiles (user_id);

alter table public.import_profiles enable row level security;
create policy "import_profiles_all_own" on public.import_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.import_profiles to authenticated;
```

- [ ] **Step 2: Aplicar** — `pnpm db:reset`.
- [ ] **Step 3: Commit** — `feat(db): import_profiles (perfil de importacao por conta)`

> **Lembrete do ambiente:** habilitar RLS não basta — a role `authenticated` precisa de `GRANT`
> (ver `0010_grants.sql`). Por isso o `grant` acima.

---

### Task 4: Saldos diários materializados + recálculo forward

Tabela de saldo diário (leitura pura para dashboard/gráficos) + função que re-materializa o range
de uma conta. Padrão `forward_calculator` + `materializer` do Maybe.

**Files:**
- Create `supabase/migrations/0014_account_balances.sql`

- [ ] **Step 1: Âncora de abertura na conta + tabela de saldos**

```sql
-- Âncora: saldo conhecido numa data inicial. O saldo diário é derivado dela + fluxos.
alter table public.accounts
  add column opening_balance_cents integer not null default 0,
  add column opening_date date not null default current_date;

-- Saldo materializado por dia (centavos). Re-gerado pela função abaixo; nunca editado à mão.
create table public.account_daily_balances (
  account_id uuid not null references public.accounts (id) on delete cascade,
  date date not null,
  balance_cents integer not null,
  currency text not null default 'BRL',
  primary key (account_id, date)
);

alter table public.account_daily_balances enable row level security;
-- Lê apenas saldos de contas do próprio usuário (join via accounts).
create policy "adb_select_own" on public.account_daily_balances
  for select using (
    exists (select 1 from public.accounts a
            where a.id = account_daily_balances.account_id and a.user_id = auth.uid())
  );
grant select on public.account_daily_balances to authenticated;
```

- [ ] **Step 2: Função de re-materialização forward**

```sql
-- Recalcula TODOS os saldos diários de uma conta, do opening_date até hoje (running balance).
-- Estratégia "re-materializa o range inteiro" (Maybe): simples e à prova de drift. Transferências
-- contam normalmente no saldo da conta (afetam o caixa real); só são excluídas dos relatórios de
-- gasto/receita, não daqui.
create or replace function public.rematerialize_account_balances(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opening_balance integer;
  v_opening_date date;
  v_running integer;
  d date;
begin
  select opening_balance_cents, opening_date
    into v_opening_balance, v_opening_date
    from public.accounts where id = p_account_id;
  if not found then return; end if;

  delete from public.account_daily_balances where account_id = p_account_id;

  v_running := v_opening_balance;
  for d in select generate_series(v_opening_date, current_date, interval '1 day')::date loop
    v_running := v_running + coalesce((
      select sum(amount_cents)::int from public.transactions
       where account_id = p_account_id and occurred_at::date = d
    ), 0);
    insert into public.account_daily_balances (account_id, date, balance_cents)
      values (p_account_id, d, v_running);
  end loop;
end;
$$;
```

- [ ] **Step 3: Aplicar** — `pnpm db:reset`.
- [ ] **Step 4: Commit** — `feat(db): saldos diarios materializados + funcao de rematerializacao forward`

> **Onde chamar a função:** após cada import confirmado e após editar/excluir transação (inclusive
> retroativa), a aplicação/queries (Plano 5) chama `select rematerialize_account_balances(:account_id)`.
> Não tentar recálculo incremental — re-materializar o range é mais simples e correto.

---

### Task 5: Testes pgTAP das novas garantias

**Files:** Create `supabase/tests/03_evolucao_schema.test.sql`

- [ ] **Step 1: Teste**

```sql
begin;
select plan(6);

-- Colunas novas existem com o tipo certo.
select has_column('public', 'transactions', 'imported_id', 'transactions.imported_id existe');
select has_column('public', 'transactions', 'transfer_id', 'transactions.transfer_id existe');
select col_type_is('public', 'transactions', 'type', 'text', 'transactions.type é text');

-- Setup mínimo.
insert into auth.users (id, email)
  values ('00000000-0000-0000-0000-0000000000c1', 'evo@test.com');
insert into public.accounts (id, user_id, name, opening_balance_cents, opening_date)
  values ('00000000-0000-0000-0000-0000000000c2',
          '00000000-0000-0000-0000-0000000000c1', 'Conta Evo', 10000, '2026-06-01');

-- FITID duplicado na mesma conta é rejeitado.
insert into public.transactions
  (user_id, account_id, amount_cents, occurred_at, dedup_hash, imported_id)
  values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c2',
          -500, '2026-06-02', 'h1', 'FIT-1');
select throws_ok(
  $$ insert into public.transactions
       (user_id, account_id, amount_cents, occurred_at, dedup_hash, imported_id)
     values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c2',
             -500, '2026-06-02', 'h2', 'FIT-1') $$,
  '23505', null, 'FITID repetido na mesma conta é rejeitado'
);

-- Re-materialização: opening 100,00 em 01/06; -5,00 em 02/06 => saldo de 02/06 = 95,00.
select public.rematerialize_account_balances('00000000-0000-0000-0000-0000000000c2');
select is(
  (select balance_cents from public.account_daily_balances
     where account_id = '00000000-0000-0000-0000-0000000000c2' and date = '2026-06-02'),
  9500, 'saldo materializado de 02/06 é 9500 (100,00 - 5,00)'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar** — `pnpm db:test` (03 verde; 00–02 continuam verdes).
- [ ] **Step 3: Commit** — `test(db): garantias da evolucao de schema (FITID, type, saldo) (pgTAP)`

---

### Task 6: PR e CI

- [ ] **Step 1: Push e PR**

```bash
git push -u origin feat/evolucao-schema-comunidade
gh pr create --base main --head feat/evolucao-schema-comunidade \
  --title "feat(db): evolucao de schema com aprendizados da comunidade" \
  --body "imported_id (FITID), imported_description, type/transfer_id, import_profiles e saldos diarios materializados. Deriva de docs/.../aprendizados-da-comunidade.md."
```

- [ ] **Step 2:** `gh run watch <run-id> --exit-status` → workflows `CI` e `DB` verdes.

---

## Fora de escopo deste plano (conscientemente)

- **Motor de regras** (`rules`/`rule_conditions`/`rule_actions` + aprendizado por consenso) →
  **Categorizer v2**, plano próprio. É a mudança de maior valor no `categorizer`, mas é grande e
  merece desenho dedicado (migrar `category_rules`, score de especificidade vs. peso, etc.).
- **Lógica de aplicação:** dedup em camadas no `importers`, helper `Trend`, views materializadas de
  dashboard (`monthly_category_spending`) → Planos 5–7.
- **Não fazer:** partida dobrada plena, RuleGroups, multi-moeda, Levenshtein, CRDT.

## Definition of Done

- `pnpm db:reset` aplica `0011–0014` sem erro.
- `pnpm db:test` verde (incluindo `03_evolucao_schema`).
- Workflows `CI` e `DB` verdes no PR.
- Colunas/tabelas prontas para o Plano 5 (queries) consumir: dedup por FITID, exclusão de
  transferências dos agregados, e leitura de `account_daily_balances` no dashboard.
</content>
