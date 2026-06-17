# Plano de Implementação — pacote `@lastro/data` (Plano 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o pacote `@lastro/data` — cliente Supabase tipado + funções de acesso a dados + fábricas de query/mutation options do TanStack — incluindo a RPC atômica `commit_import`.

**Architecture:** Funções async puras recebem o `DataClient` por injeção de dependência. A escrita multi-tabela da importação vive numa função Postgres (RPC `commit_import`) para ser atômica. Uma fina camada de `queryOptions`/`mutationOptions` (de `@tanstack/react-query`) com chaves de cache únicas é compartilhada por Web e Mobile. Tipos vêm do schema via `supabase gen types`.

**Tech Stack:** TypeScript strict, `@supabase/supabase-js`, `@tanstack/react-query` (`react` peerDep), Zod, Vitest, pgTAP, pnpm + Turborepo.

**Spec:** `docs/superpowers/specs/2026-06-16-pacote-data-design.md`

**Convenções deste repo (já estabelecidas):**
- Bash precisa de `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm"` antes de `pnpm`.
- Rodar comandos a partir da raiz do worktree. Pacotes em `packages/*` (auto-incluídos no workspace).
- CI: job `verify` roda lint/typecheck/test (sem Supabase); job `DB` sobe Supabase e roda pgTAP.
- Testes Node de integração com Supabase ficam **gated** (pulam sem `SUPABASE_URL`).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `packages/data/package.json` | manifesto do pacote, deps |
| `packages/data/tsconfig.json` | extends da base |
| `packages/data/src/database.types.ts` | tipos `Database` gerados (não editar à mão) |
| `packages/data/src/client.ts` | `createDataClient`, tipo `DataClient` |
| `packages/data/src/errors.ts` | `DataError`, `unwrap` |
| `packages/data/src/types.ts` | tipos de domínio + Zod das bordas |
| `packages/data/src/keys.ts` | chaves de cache (`dataKeys`) |
| `packages/data/src/imports.ts` | `commitImport` (orquestração TS + RPC) |
| `packages/data/src/queries.ts` | fábricas `queryOptions` |
| `packages/data/src/mutations.ts` | fábricas `mutationOptions` |
| `packages/data/src/index.ts` | re-exports públicos |
| `packages/data/src/_fake.ts` | fake de `DataClient` para testes unitários |
| `supabase/migrations/0011_commit_import_fn.sql` | RPC `commit_import` |
| `supabase/tests/03_commit_import.test.sql` | teste pgTAP da RPC |

---

## Task 1: Scaffold do pacote `@lastro/data`

**Files:**
- Create: `packages/data/package.json`
- Create: `packages/data/tsconfig.json`
- Create: `packages/data/src/index.ts` (stub)

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "@lastro/data",
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
    "@lastro/categorizer": "workspace:*",
    "@lastro/importers": "workspace:*",
    "@lastro/shared": "workspace:*",
    "@supabase/supabase-js": "^2.45.0",
    "@tanstack/react-query": "^5.59.0",
    "zod": "^3.23.8"
  },
  "peerDependencies": {
    "react": ">=18"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "react": "^18.3.0"
  }
}
```

- [ ] **Step 2: Criar `tsconfig.json`** (espelha os outros pacotes)

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

- [ ] **Step 3: Criar stub `src/index.ts`** (evita pacote vazio)

```ts
export {};
```

- [ ] **Step 4: Instalar deps**

Run: `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm" && pnpm install`
Expected: instala `@supabase/supabase-js`, `@tanstack/react-query`, `react` sem erro; atualiza `pnpm-lock.yaml`.

- [ ] **Step 5: Commit**

```bash
git add packages/data/package.json packages/data/tsconfig.json packages/data/src/index.ts pnpm-lock.yaml
git commit -m "chore(data): scaffold do pacote @lastro/data"
```

---

## Task 2: `errors.ts` — `DataError` e `unwrap`

**Files:**
- Create: `packages/data/src/errors.ts`
- Test: `packages/data/src/errors.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from 'vitest';
import { DataError, unwrap } from './errors';

describe('unwrap', () => {
  it('devolve data quando não há erro', () => {
    expect(unwrap({ data: [1, 2], error: null })).toEqual([1, 2]);
  });

  it('lança DataError quando há erro', () => {
    const error = { message: 'boom', code: '42501', details: 'x', hint: '' };
    expect(() => unwrap({ data: null, error })).toThrow(DataError);
    try {
      unwrap({ data: null, error });
    } catch (e) {
      expect((e as DataError).message).toBe('boom');
      expect((e as DataError).cause).toBe(error);
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm" && pnpm --filter @lastro/data test`
Expected: FAIL — "Cannot find module './errors'".

- [ ] **Step 3: Implementar `errors.ts`**

```ts
import type { PostgrestError } from '@supabase/supabase-js';

/** Erro tipado de qualquer operação Supabase/PostgREST. */
export class DataError extends Error {
  constructor(public readonly cause: PostgrestError) {
    super(cause.message);
    this.name = 'DataError';
  }
}

/** Desembrulha a resposta `{ data, error }` do supabase-js; lança em caso de erro. */
export function unwrap<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw new DataError(res.error);
  return res.data as T;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm" && pnpm --filter @lastro/data test`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add packages/data/src/errors.ts packages/data/src/errors.test.ts
git commit -m "feat(data): DataError e unwrap"
```

---

## Task 3: Tipos gerados, `client.ts` e `types.ts`

**Files:**
- Modify: `package.json` (raiz) — script `db:types`
- Create: `packages/data/src/database.types.ts` (gerado)
- Create: `packages/data/src/client.ts`
- Create: `packages/data/src/types.ts`

- [ ] **Step 1: Adicionar script `db:types` na raiz**

Em `package.json` (raiz), dentro de `"scripts"`, adicionar:

```json
"db:types": "supabase gen types typescript --local > packages/data/src/database.types.ts"
```

- [ ] **Step 2: Subir o Supabase local e gerar os tipos**

Run:
```bash
export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm"
pnpm db:start && pnpm db:reset && pnpm db:types
```
Expected: cria `packages/data/src/database.types.ts` com `export type Database = { ... }` contendo as 6 tabelas. (Docker Desktop precisa estar rodando — ver memória de ambiente.)

- [ ] **Step 3: Criar `client.ts`**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type DataClient = SupabaseClient<Database>;

/** Cria um cliente Supabase tipado pelo schema do Lastro. */
export function createDataClient(url: string, anonKey: string): DataClient {
  return createClient<Database>(url, anonKey);
}
```

- [ ] **Step 4: Criar `types.ts`** (tipos de domínio + Zod das bordas)

```ts
import { z } from 'zod';
import type { Database } from './database.types';

type Tables = Database['public']['Tables'];

export type Account = Tables['accounts']['Row'];
export type Category = Tables['categories']['Row'];
export type Transaction = Tables['transactions']['Row'];
export type CategoryRuleRow = Tables['category_rules']['Row'];

export type NewAccount = Pick<Tables['accounts']['Insert'], 'name' | 'type' | 'institution'>;
export type NewCategory = Pick<Tables['categories']['Insert'], 'name' | 'icon' | 'color' | 'kind'>;
export type NewManualTransaction = Pick<
  Tables['transactions']['Insert'],
  'account_id' | 'amount_cents' | 'description' | 'occurred_at' | 'category_id'
> & { dedup_hash: string };
export type NewRule = Pick<
  Tables['category_rules']['Insert'],
  'match_type' | 'pattern' | 'category_id' | 'weight'
>;

export type TransactionFilter = { accountId?: string; from?: string; to?: string };

/** Input validado de uma importação (transações vêm de @lastro/importers). */
export const commitImportInputSchema = z.object({
  accountId: z.string().uuid(),
  format: z.enum(['csv', 'ofx']),
  fileName: z.string().optional(),
  transactions: z.array(
    z.object({
      occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      amountCents: z.number().int(),
      description: z.string(),
      dedupHash: z.string().min(1),
    }),
  ),
});
export type CommitImportInput = z.infer<typeof commitImportInputSchema>;
export type CommitImportResult = { importId: string; inserted: number; duplicates: number };
```

- [ ] **Step 5: Typecheck**

Run: `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm" && pnpm --filter @lastro/data typecheck`
Expected: PASS (sem erros — os tipos gerados resolvem todas as referências).

- [ ] **Step 6: Commit**

```bash
git add package.json packages/data/src/database.types.ts packages/data/src/client.ts packages/data/src/types.ts
git commit -m "feat(data): cliente tipado, tipos de dominio e script db:types"
```

---

## Task 4: `keys.ts` — chaves de cache

**Files:**
- Create: `packages/data/src/keys.ts`
- Test: `packages/data/src/keys.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from 'vitest';
import { dataKeys } from './keys';

describe('dataKeys', () => {
  it('chaves estáticas estáveis', () => {
    expect(dataKeys.accounts()).toEqual(['accounts']);
    expect(dataKeys.categories()).toEqual(['categories']);
    expect(dataKeys.rules()).toEqual(['rules']);
  });

  it('transactions sem filtro vs com filtro', () => {
    expect(dataKeys.transactions()).toEqual(['transactions']);
    expect(dataKeys.transactions({ accountId: 'a1' })).toEqual(['transactions', { accountId: 'a1' }]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm" && pnpm --filter @lastro/data test`
Expected: FAIL — "Cannot find module './keys'".

- [ ] **Step 3: Implementar `keys.ts`**

```ts
import type { TransactionFilter } from './types';

/** Chaves de cache do TanStack — fonte única, compartilhada por Web e Mobile. */
export const dataKeys = {
  accounts: () => ['accounts'] as const,
  categories: () => ['categories'] as const,
  rules: () => ['rules'] as const,
  transactions: (filter?: TransactionFilter) =>
    filter === undefined
      ? (['transactions'] as const)
      : (['transactions', filter] as const),
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm" && pnpm --filter @lastro/data test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/data/src/keys.ts packages/data/src/keys.test.ts
git commit -m "feat(data): chaves de cache (dataKeys)"
```

---

## Task 5: RPC `commit_import` (migration + teste pgTAP)

**Files:**
- Create: `supabase/migrations/0011_commit_import_fn.sql`
- Create: `supabase/tests/03_commit_import.test.sql`

- [ ] **Step 1: Escrever o teste pgTAP que falha**

`supabase/tests/03_commit_import.test.sql`:

```sql
begin;
select plan(4);

-- Usuário + conta de teste.
insert into auth.users (id, email)
  values ('00000000-0000-0000-0000-0000000000c1', 'commit@test.com');
insert into public.accounts (id, user_id, name)
  values ('00000000-0000-0000-0000-0000000000c2',
          '00000000-0000-0000-0000-0000000000c1', 'Conta Commit');

-- Vira o usuário (authenticated + JWT) para a RPC enxergar auth.uid().
set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

-- Chamada com 2 itens distintos: insere 2, 0 duplicados.
select is(
  (select public.commit_import(
    '00000000-0000-0000-0000-0000000000c2', 'csv', 'extrato.csv',
    '[{"amount_cents":-1500,"description":"Uber","occurred_at":"2026-05-01","dedup_hash":"h1","category_id":null},
      {"amount_cents":-3000,"description":"Sushi","occurred_at":"2026-05-02","dedup_hash":"h2","category_id":null}]'::jsonb
  ) ->> 'inserted')::int,
  2, 'insere 2 transações novas'
);

-- Reimportar os mesmos hashes: 0 inseridos, 2 duplicados (dedup do banco).
select is(
  (select public.commit_import(
    '00000000-0000-0000-0000-0000000000c2', 'csv', 'extrato.csv',
    '[{"amount_cents":-1500,"description":"Uber","occurred_at":"2026-05-01","dedup_hash":"h1","category_id":null},
      {"amount_cents":-3000,"description":"Sushi","occurred_at":"2026-05-02","dedup_hash":"h2","category_id":null}]'::jsonb
  ) ->> 'duplicates')::int,
  2, 'reimportação detecta 2 duplicados'
);

-- Total de transações do usuário = 2 (duplicados não entram).
select is(
  (select count(*)::int from public.transactions
   where user_id = '00000000-0000-0000-0000-0000000000c1'),
  2, 'duplicados não são gravados'
);

-- Atomicidade: item inválido (amount_cents nulo viola NOT NULL) → rollback total,
-- nenhum import novo é criado.
select throws_ok(
  $$ select public.commit_import(
       '00000000-0000-0000-0000-0000000000c2', 'csv', 'ruim.csv',
       '[{"amount_cents":null,"description":"X","occurred_at":"2026-05-03","dedup_hash":"h3","category_id":null}]'::jsonb
     ) $$
);

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm" && pnpm db:reset && pnpm db:test`
Expected: FAIL — função `public.commit_import` não existe.

- [ ] **Step 3: Implementar a migration**

`supabase/migrations/0011_commit_import_fn.sql`:

```sql
-- Importa um lote de transações atomicamente: cria a linha de auditoria em `imports`
-- e insere as transações (ignorando duplicadas por (user_id, dedup_hash)).
-- security invoker: roda como o usuário chamador, respeitando RLS e auth.uid().
create or replace function public.commit_import(
  p_account_id uuid,
  p_format text,
  p_file_name text,
  p_items jsonb
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_import_id uuid;
  v_total int := jsonb_array_length(p_items);
  v_inserted int;
begin
  if v_user_id is null then
    raise exception 'commit_import: usuário não autenticado';
  end if;

  insert into public.imports (user_id, account_id, source_format, file_name, row_count)
  values (v_user_id, p_account_id, p_format, p_file_name, v_total)
  returning id into v_import_id;

  with ins as (
    insert into public.transactions
      (user_id, account_id, category_id, amount_cents, description, occurred_at, dedup_hash, import_id)
    select
      v_user_id,
      p_account_id,
      nullif(item->>'category_id', '')::uuid,
      (item->>'amount_cents')::int,
      item->>'description',
      (item->>'occurred_at')::timestamptz,
      item->>'dedup_hash',
      v_import_id
    from jsonb_array_elements(p_items) as item
    on conflict (user_id, dedup_hash) do nothing
    returning 1
  )
  select count(*)::int into v_inserted from ins;

  return jsonb_build_object(
    'import_id', v_import_id,
    'inserted', v_inserted,
    'duplicates', v_total - v_inserted
  );
end;
$$;

grant execute on function public.commit_import(uuid, text, text, jsonb) to authenticated;
```

Nota: `(item->>'amount_cents')::int` com valor JSON `null` resulta em NULL → viola o `not null`
de `transactions.amount_cents`, o que faz a função inteira reverter (atomicidade testada no Step 1).

- [ ] **Step 4: Rodar e ver passar**

Run: `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm" && pnpm db:reset && pnpm db:test`
Expected: PASS — todos os planos (incluindo `03_commit_import`) verdes.

- [ ] **Step 5: Regenerar os tipos** (a RPC entra em `Database['public']['Functions']`)

Run: `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm" && pnpm db:types`
Expected: `database.types.ts` agora inclui `commit_import` em `Functions`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0011_commit_import_fn.sql supabase/tests/03_commit_import.test.sql packages/data/src/database.types.ts
git commit -m "feat(db): RPC atomica commit_import + teste pgTAP"
```

---

## Task 6: `commitImport` — orquestração em TS

**Files:**
- Create: `packages/data/src/_fake.ts` (fake de `DataClient` para testes)
- Create: `packages/data/src/imports.ts`
- Test: `packages/data/src/imports.test.ts`

- [ ] **Step 1: Criar o fake de `DataClient`**

`packages/data/src/_fake.ts`:

```ts
import type { DataClient } from './client';

export type FakeRpcCall = { fn: string; args: Record<string, unknown> };

/** Fake mínimo de DataClient para testar orquestração sem banco. */
export function makeFakeClient(opts: {
  tables?: Record<string, unknown[]>;
  rpcResult?: unknown;
}): { client: DataClient; rpcCalls: FakeRpcCall[] } {
  const rpcCalls: FakeRpcCall[] = [];
  const client = {
    from(table: string) {
      return {
        select: () => Promise.resolve({ data: opts.tables?.[table] ?? [], error: null }),
      };
    },
    rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: opts.rpcResult ?? null, error: null });
    },
  } as unknown as DataClient;
  return { client, rpcCalls };
}
```

- [ ] **Step 2: Escrever o teste que falha**

`packages/data/src/imports.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { commitImport } from './imports';
import { makeFakeClient } from './_fake';

const ACCOUNT = '00000000-0000-0000-0000-0000000000c2';

describe('commitImport', () => {
  it('categoriza via defaultRules, mapeia nome→id e chama a RPC', async () => {
    const { client, rpcCalls } = makeFakeClient({
      tables: {
        category_rules: [], // sem regras do usuário → usa defaultRules
        categories: [
          { id: 'cat-transporte', name: 'Transporte' },
          { id: 'cat-alimentacao', name: 'Alimentação' },
        ],
      },
      rpcResult: { import_id: 'imp-1', inserted: 2, duplicates: 0 },
    });

    const result = await commitImport(client, {
      accountId: ACCOUNT,
      format: 'csv',
      fileName: 'extrato.csv',
      transactions: [
        { occurredAt: '2026-05-01', amountCents: -1500, description: 'UBER *TRIP', dedupHash: 'h1' },
        { occurredAt: '2026-05-02', amountCents: -3000, description: 'SUSHI BAR', dedupHash: 'h2' },
      ],
    });

    expect(result).toEqual({ importId: 'imp-1', inserted: 2, duplicates: 0 });
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]!.fn).toBe('commit_import');
    const items = rpcCalls[0]!.args.p_items as Array<{ dedup_hash: string; category_id: string | null }>;
    expect(items.find((i) => i.dedup_hash === 'h1')!.category_id).toBe('cat-transporte');
    expect(items.find((i) => i.dedup_hash === 'h2')!.category_id).toBe('cat-alimentacao');
  });

  it('category_id = null quando nenhuma regra casa', async () => {
    const { client, rpcCalls } = makeFakeClient({
      tables: { category_rules: [], categories: [] },
      rpcResult: { import_id: 'imp-2', inserted: 1, duplicates: 0 },
    });
    await commitImport(client, {
      accountId: ACCOUNT,
      format: 'csv',
      transactions: [
        { occurredAt: '2026-05-01', amountCents: -100, description: 'XYZ DESCONHECIDO', dedupHash: 'h9' },
      ],
    });
    const items = rpcCalls[0]!.args.p_items as Array<{ category_id: string | null }>;
    expect(items[0]!.category_id).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm" && pnpm --filter @lastro/data test`
Expected: FAIL — "Cannot find module './imports'".

- [ ] **Step 4: Implementar `imports.ts`**

```ts
import { categorize, defaultRules, type CategoryRule } from '@lastro/categorizer';
import type { DataClient } from './client';
import { unwrap } from './errors';
import {
  commitImportInputSchema,
  type CommitImportInput,
  type CommitImportResult,
} from './types';

/** Importa um lote de transações: categoriza em TS e grava via RPC atômica. */
export async function commitImport(
  c: DataClient,
  input: CommitImportInput,
): Promise<CommitImportResult> {
  const parsed = commitImportInputSchema.parse(input);

  const ruleRows = unwrap(await c.from('category_rules').select('*')) as Array<{
    match_type: string;
    pattern: string;
    category_id: string;
    weight: number;
  }>;
  const categories = unwrap(await c.from('categories').select('id, name')) as Array<{
    id: string;
    name: string;
  }>;

  const nameById = new Map(categories.map((r) => [r.id, r.name]));
  const idByName = new Map(categories.map((r) => [r.name, r.id]));

  // Regras do usuário (category_id → nome) + regras-semente. Usuário tem prioridade (peso já manda).
  const userRules: CategoryRule[] = ruleRows.flatMap((r) => {
    const name = nameById.get(r.category_id);
    return name
      ? [{ matchType: r.match_type as CategoryRule['matchType'], pattern: r.pattern, category: name, weight: r.weight }]
      : [];
  });
  const rules = [...userRules, ...defaultRules];

  const items = parsed.transactions.map((t) => {
    const { category } = categorize(t.description, rules);
    return {
      amount_cents: t.amountCents,
      description: t.description,
      occurred_at: t.occurredAt,
      dedup_hash: t.dedupHash,
      category_id: category ? (idByName.get(category) ?? null) : null,
    };
  });

  const res = await c.rpc('commit_import', {
    p_account_id: parsed.accountId,
    p_format: parsed.format,
    p_file_name: parsed.fileName ?? null,
    p_items: items,
  });
  const out = unwrap(res) as { import_id: string; inserted: number; duplicates: number };
  return { importId: out.import_id, inserted: out.inserted, duplicates: out.duplicates };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm" && pnpm --filter @lastro/data test`
Expected: PASS (2 testes de `imports`).

- [ ] **Step 6: Commit**

```bash
git add packages/data/src/_fake.ts packages/data/src/imports.ts packages/data/src/imports.test.ts
git commit -m "feat(data): commitImport (categoriza em TS + RPC atomica)"
```

---

## Task 7: `queries.ts` — fábricas `queryOptions`

**Files:**
- Create: `packages/data/src/queries.ts`
- Test: `packages/data/src/queries.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from 'vitest';
import { accountsQuery, transactionsQuery } from './queries';
import { makeFakeClient } from './_fake';

describe('queries', () => {
  it('accountsQuery usa a chave certa e busca a tabela', async () => {
    const { client } = makeFakeClient({ tables: { accounts: [{ id: 'a1', name: 'Nubank' }] } });
    const opts = accountsQuery(client);
    expect(opts.queryKey).toEqual(['accounts']);
    const data = await opts.queryFn!({} as never);
    expect(data).toEqual([{ id: 'a1', name: 'Nubank' }]);
  });

  it('transactionsQuery embute o filtro na chave', () => {
    const { client } = makeFakeClient({ tables: { transactions: [] } });
    const opts = transactionsQuery(client, { accountId: 'a1' });
    expect(opts.queryKey).toEqual(['transactions', { accountId: 'a1' }]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm" && pnpm --filter @lastro/data test`
Expected: FAIL — "Cannot find module './queries'".

- [ ] **Step 3: Implementar `queries.ts`**

CRUD trivial fica como `queryFn` fino inline (sem wrappers redundantes); só os filtros têm lógica.

```ts
import { queryOptions } from '@tanstack/react-query';
import type { DataClient } from './client';
import { unwrap } from './errors';
import { dataKeys } from './keys';
import type { Account, Category, CategoryRuleRow, Transaction, TransactionFilter } from './types';

export const accountsQuery = (c: DataClient) =>
  queryOptions({
    queryKey: dataKeys.accounts(),
    queryFn: async (): Promise<Account[]> =>
      unwrap(await c.from('accounts').select('*').order('created_at')),
  });

export const categoriesQuery = (c: DataClient) =>
  queryOptions({
    queryKey: dataKeys.categories(),
    queryFn: async (): Promise<Category[]> =>
      unwrap(await c.from('categories').select('*').order('name')),
  });

export const rulesQuery = (c: DataClient) =>
  queryOptions({
    queryKey: dataKeys.rules(),
    queryFn: async (): Promise<CategoryRuleRow[]> => unwrap(await c.from('category_rules').select('*')),
  });

export const transactionsQuery = (c: DataClient, filter?: TransactionFilter) =>
  queryOptions({
    queryKey: dataKeys.transactions(filter),
    queryFn: async (): Promise<Transaction[]> => {
      let q = c.from('transactions').select('*').order('occurred_at', { ascending: false });
      if (filter?.accountId) q = q.eq('account_id', filter.accountId);
      if (filter?.from) q = q.gte('occurred_at', filter.from);
      if (filter?.to) q = q.lte('occurred_at', filter.to);
      return unwrap(await q);
    },
  });
```

Nota: o fake do Task 6 só implementa `.select()` retornando os dados; para `accountsQuery`
(que encadeia `.order()`) e `transactionsQuery` (que encadeia `.eq/.gte/.lte`), estender o fake
no próximo step antes de rodar.

- [ ] **Step 4: Estender o fake para suportar o builder encadeado**

Em `packages/data/src/_fake.ts`, substituir o método `from` por um builder thenable:

```ts
    from(table: string) {
      const data = opts.tables?.[table] ?? [];
      const builder: Record<string, unknown> = {
        select: () => builder,
        order: () => builder,
        eq: () => builder,
        gte: () => builder,
        lte: () => builder,
        then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
          resolve({ data, error: null }),
      };
      return builder;
    },
```

(O `then` torna o builder aguardável: `await c.from('x').select()...` resolve para `{ data, error }`.)

- [ ] **Step 5: Rodar e ver passar**

Run: `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm" && pnpm --filter @lastro/data test`
Expected: PASS (queries + imports continuam verdes).

- [ ] **Step 6: Commit**

```bash
git add packages/data/src/queries.ts packages/data/src/queries.test.ts packages/data/src/_fake.ts
git commit -m "feat(data): fabricas queryOptions (accounts/categories/rules/transactions)"
```

---

## Task 8: `mutations.ts` — fábricas `mutationOptions`

**Files:**
- Create: `packages/data/src/mutations.ts`
- Test: `packages/data/src/mutations.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { commitImportMutation, updateTransactionCategoryMutation } from './mutations';
import { makeFakeClient } from './_fake';

describe('mutations', () => {
  it('commitImportMutation invalida transactions no sucesso', async () => {
    const { client } = makeFakeClient({
      tables: { category_rules: [], categories: [] },
      rpcResult: { import_id: 'imp-1', inserted: 1, duplicates: 0 },
    });
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const opts = commitImportMutation(client, qc);

    const res = await opts.mutationFn!({
      accountId: '00000000-0000-0000-0000-0000000000c2',
      format: 'csv',
      transactions: [{ occurredAt: '2026-05-01', amountCents: -100, description: 'X', dedupHash: 'h1' }],
    });
    await opts.onSuccess?.(res, {} as never, {} as never);

    expect(res.inserted).toBe(1);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['transactions'] });
  });

  it('updateTransactionCategoryMutation chama update na tabela', async () => {
    const { client, updateCalls } = makeFakeClient({ tables: { transactions: [] } });
    const qc = new QueryClient();
    const opts = updateTransactionCategoryMutation(client, qc);
    await opts.mutationFn!({ id: 't1', categoryId: 'cat-1' });
    expect(updateCalls).toContainEqual({ table: 'transactions', values: { category_id: 'cat-1' }, eqId: 't1' });
  });
});
```

- [ ] **Step 2: Estender o fake para `update`/`insert`/`delete`**

Em `_fake.ts`, adicionar arrays de captura e métodos ao builder. Substituir o retorno de `makeFakeClient` e o builder por:

```ts
export function makeFakeClient(opts: {
  tables?: Record<string, unknown[]>;
  rpcResult?: unknown;
}): {
  client: DataClient;
  rpcCalls: FakeRpcCall[];
  updateCalls: Array<{ table: string; values: Record<string, unknown>; eqId?: string }>;
} {
  const rpcCalls: FakeRpcCall[] = [];
  const updateCalls: Array<{ table: string; values: Record<string, unknown>; eqId?: string }> = [];
  const client = {
    from(table: string) {
      const data = opts.tables?.[table] ?? [];
      let pendingUpdate: Record<string, unknown> | null = null;
      const builder: Record<string, unknown> = {
        select: () => builder,
        order: () => builder,
        eq: (col: string, val: string) => {
          if (pendingUpdate) updateCalls.push({ table, values: pendingUpdate, eqId: val });
          return builder;
        },
        gte: () => builder,
        lte: () => builder,
        update: (values: Record<string, unknown>) => {
          pendingUpdate = values;
          return builder;
        },
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: data[0] ?? null, error: null }) }) }),
        delete: () => builder,
        then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
          resolve({ data, error: null }),
      };
      return builder;
    },
    rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: opts.rpcResult ?? null, error: null });
    },
  } as unknown as DataClient;
  return { client, rpcCalls, updateCalls };
}
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm" && pnpm --filter @lastro/data test`
Expected: FAIL — "Cannot find module './mutations'".

- [ ] **Step 4: Implementar `mutations.ts`**

```ts
import { mutationOptions, type QueryClient } from '@tanstack/react-query';
import type { DataClient } from './client';
import { unwrap } from './errors';
import { commitImport } from './imports';
import { dataKeys } from './keys';
import type {
  Account,
  Category,
  CommitImportInput,
  CommitImportResult,
  NewAccount,
  NewCategory,
  NewManualTransaction,
  NewRule,
  Transaction,
} from './types';

export const createAccountMutation = (c: DataClient, qc: QueryClient) =>
  mutationOptions({
    mutationFn: async (input: NewAccount): Promise<Account> =>
      unwrap(await c.from('accounts').insert(input).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: dataKeys.accounts() }),
  });

export const archiveAccountMutation = (c: DataClient, qc: QueryClient) =>
  mutationOptions({
    mutationFn: async (id: string): Promise<void> => {
      unwrap(await c.from('accounts').update({ archived: true }).eq('id', id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dataKeys.accounts() }),
  });

export const createCategoryMutation = (c: DataClient, qc: QueryClient) =>
  mutationOptions({
    mutationFn: async (input: NewCategory): Promise<Category> =>
      unwrap(await c.from('categories').insert(input).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: dataKeys.categories() }),
  });

export const insertManualTransactionMutation = (c: DataClient, qc: QueryClient) =>
  mutationOptions({
    mutationFn: async (input: NewManualTransaction): Promise<Transaction> =>
      unwrap(await c.from('transactions').insert({ ...input, is_manual: true }).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: dataKeys.transactions() }),
  });

export const updateTransactionCategoryMutation = (c: DataClient, qc: QueryClient) =>
  mutationOptions({
    mutationFn: async (input: { id: string; categoryId: string | null }): Promise<void> => {
      unwrap(await c.from('transactions').update({ category_id: input.categoryId }).eq('id', input.id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dataKeys.transactions() }),
  });

export const deleteTransactionMutation = (c: DataClient, qc: QueryClient) =>
  mutationOptions({
    mutationFn: async (id: string): Promise<void> => {
      unwrap(await c.from('transactions').delete().eq('id', id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dataKeys.transactions() }),
  });

export const createRuleMutation = (c: DataClient, qc: QueryClient) =>
  mutationOptions({
    mutationFn: async (input: NewRule) => unwrap(await c.from('category_rules').insert(input).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: dataKeys.rules() }),
  });

export const deleteRuleMutation = (c: DataClient, qc: QueryClient) =>
  mutationOptions({
    mutationFn: async (id: string): Promise<void> => {
      unwrap(await c.from('category_rules').delete().eq('id', id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: dataKeys.rules() }),
  });

export const commitImportMutation = (c: DataClient, qc: QueryClient) =>
  mutationOptions({
    mutationFn: (input: CommitImportInput): Promise<CommitImportResult> => commitImport(c, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: dataKeys.transactions() }),
  });
```

- [ ] **Step 5: Rodar e ver passar**

Run: `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm" && pnpm --filter @lastro/data test`
Expected: PASS (todos os testes do pacote).

- [ ] **Step 6: Commit**

```bash
git add packages/data/src/mutations.ts packages/data/src/mutations.test.ts packages/data/src/_fake.ts
git commit -m "feat(data): fabricas mutationOptions (writes + commitImport)"
```

---

## Task 9: `index.ts` público + verificação final

**Files:**
- Modify: `packages/data/src/index.ts`

- [ ] **Step 1: Escrever os re-exports públicos**

Substituir o stub de `index.ts` por:

```ts
export { createDataClient, type DataClient } from './client';
export { DataError, unwrap } from './errors';
export { dataKeys } from './keys';
export { commitImport } from './imports';
export {
  accountsQuery,
  categoriesQuery,
  rulesQuery,
  transactionsQuery,
} from './queries';
export {
  archiveAccountMutation,
  commitImportMutation,
  createAccountMutation,
  createCategoryMutation,
  createRuleMutation,
  deleteRuleMutation,
  deleteTransactionMutation,
  insertManualTransactionMutation,
  updateTransactionCategoryMutation,
} from './mutations';
export type {
  Account,
  Category,
  CategoryRuleRow,
  CommitImportInput,
  CommitImportResult,
  NewAccount,
  NewCategory,
  NewManualTransaction,
  NewRule,
  Transaction,
  TransactionFilter,
} from './types';
```

(Não re-exportar `_fake.ts` — é só para testes.)

- [ ] **Step 2: Verificação completa do monorepo**

Run:
```bash
export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm"
pnpm lint && pnpm typecheck && pnpm test && pnpm format:check
```
Expected: tudo verde nos 4 pacotes (`shared`, `importers`, `categorizer`, `data`).

- [ ] **Step 3: Verificação do banco (pgTAP)**

Run: `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm" && pnpm db:reset && pnpm db:test`
Expected: todos os planos pgTAP verdes (incluindo `03_commit_import`).

- [ ] **Step 4: Format (se o format:check apontou algo)**

Run: `export PATH="$PATH:/c/Users/guilh/AppData/Roaming/npm" && pnpm format`

- [ ] **Step 5: Commit final**

```bash
git add packages/data/src/index.ts
git commit -m "feat(data): API publica do pacote @lastro/data"
```

---

## Encerramento (após todas as tasks)

1. Abrir PR com a skill `pr` (branch `plano-05-data` → `main`).
2. Esperar CI (jobs `verify` + `DB`) e checagem de DB verdes.
3. Merge squash + limpeza do worktree e branch (skill `finishing-a-development-branch`).
4. Parar o Supabase local (`pnpm db:stop`) **antes** de remover o worktree (ver memória de ambiente).
5. Atualizar a memória `lastro-projeto.md`: Plano 5 concluído (PR #5), pacote `@lastro/data` com
   cliente tipado + queries/mutations + RPC `commit_import`; próximo = Plano 6 (Web).

---

## Self-Review (preenchido)

**Cobertura do spec:**
- §1 fronteira (funções puras + factory react-query, react peerDep) → Tasks 1, 7, 8 ✅
- §2 cliente tipado + db:types → Task 3 ✅
- §3 módulos (client/errors/types/keys/queries/mutations/imports/index) → Tasks 2–9 ✅
- §5 commitImport atômico via RPC → Tasks 5 (RPC) + 6 (orquestração) ✅
- §6 erros (DataError/unwrap + Zod na borda) → Tasks 2, 3, 6 ✅
- §7 testes (pgTAP da RPC + unitários com fake) → Tasks 5, 6, 7, 8 ✅
- §8 deps + script db:types → Tasks 1, 3 ✅
- §4 escopo: agregações de dashboard fora (confirmado, sem task) ✅

**Placeholders:** nenhum — todo step tem código/comando completo.

**Consistência de tipos:** `DataClient`, `dataKeys`, `commitImport`, `CommitImportInput/Result`,
nomes de colunas (`category_id`, `amount_cents`, `dedup_hash`, `occurred_at`, `archived`) e a
assinatura da RPC (`p_account_id`, `p_format`, `p_file_name`, `p_items`) batem entre as tasks e a migration.
