# Design — Plano 5: pacote `@lastro/data`

> Camada de acesso a dados do Lastro: cliente Supabase tipado + *query-options factory*
> agnóstico de framework, ligando os pacotes existentes (`importers`, `categorizer`, `shared`)
> ao banco. Consumida por Web (Plano 6) e Mobile (Plano 7) via TanStack Query.

## 1. Objetivo e fronteira

Entregar **`@lastro/data`**: o contrato único de *como o app fala com o banco*, sobre um
**cliente Supabase tipado**. Expõe duas camadas:

1. **Funções de orquestração/consulta** com valor real (`commitImport`, filtros de transação,
   mapeamento de categoria). CRUD trivial **não** vira wrapper — usa o `supabase-js` direto no
   `queryFn`, sem cerimônia.
2. **Fábrica de *query options* / *mutation options*** usando `@tanstack/query-core`
   (que é **agnóstico de framework** — não é React). Define as **chaves de cache uma vez só**,
   compartilhadas entre Web e Mobile, sem duplicação.

**Decisão de fronteira:** o pacote **não** importa `react` nem `@tanstack/react-query` — só o
`query-core`. Os hooks (`useQuery(...)`) são triviais em Web/Mobile, passando os `queryOptions`
prontos. Isso mantém o pacote testável em Node e elimina a duplicação de chaves/queryFns que
existiria se cada cliente reimplementasse a camada.

## 2. Cliente tipado

- **Factory:** `createDataClient(url: string, anonKey: string): DataClient` onde
  `DataClient = SupabaseClient<Database>`. As funções de dados e os `queryFn` recebem o
  `DataClient` por **injeção de dependência** — sem singleton global, fácil de testar.
- **Tipos do banco gerados:** `Database` gerado do schema local via
  `supabase gen types typescript --local`, salvo em `packages/data/src/database.types.ts`
  (versionado). Novo script de raiz `db:types`. Os tipos seguem as migrations automaticamente —
  **uma fonte de verdade só (o SQL)**.
- **Tipos de domínio:** `Account`, `Category`, `Transaction`, etc. derivados dos tipos
  `Row`/`Insert` gerados.
- **Zod só nas bordas de entrada** (input de `commitImport`). Leituras do nosso próprio banco
  confiam no tipo gerado.

## 3. Módulos (um arquivo = um propósito)

| Arquivo | Conteúdo |
|---|---|
| `client.ts` | `createDataClient`, tipo `DataClient` |
| `errors.ts` | `DataError`, helper `unwrap` |
| `database.types.ts` | tipos `Database` gerados (não editar à mão) |
| `types.ts` | tipos de domínio + schemas Zod das bordas |
| `keys.ts` | **chaves de cache** (`accountsKey`, `transactionsKey(filter)`, …) — fonte única |
| `queries.ts` | fábricas `queryOptions` (reads); `queryFn` finos no CRUD trivial |
| `mutations.ts` | fábricas `mutationOptions` (writes) + invalidação de chaves |
| `imports.ts` | `commitImport` (orquestração TS + RPC — ver §5) |
| `index.ts` | re-exports públicos |

### Forma das fábricas (agnóstico de framework)

```ts
// queries.ts — devolve config pura do query-core, sem React
export const transactionsQuery = (c: DataClient, filter?: TransactionFilter) =>
  queryOptions({
    queryKey: transactionsKey(filter),
    queryFn: async () => {
      let q = c.from('transactions').select('*').order('occurred_at', { ascending: false });
      if (filter?.accountId) q = q.eq('account_id', filter.accountId);
      if (filter?.from) q = q.gte('occurred_at', filter.from);
      if (filter?.to) q = q.lte('occurred_at', filter.to);
      return unwrap(await q); // Transaction[]
    },
  });

// uso em Web/Mobile (trivial, fora deste pacote):
//   const { data } = useQuery(transactionsQuery(client, { accountId }));
```

```ts
// mutations.ts
export const commitImportMutation = (c: DataClient, queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: (input: CommitImportInput) => commitImport(c, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: transactionsKey() }),
  });
```

**Reads cobertos:** contas, categorias, transações (com filtro), regras.
**Writes cobertos:** criar/arquivar conta, criar categoria, lançar transação manual, editar
categoria, excluir transação, criar/excluir regra, `commitImport`.

## 4. Escopo de v1 e o que fica de fora

**Dentro:** contas, categorias, transações (listar com filtro, manual, editar categoria,
excluir), regras de categoria e a importação (`commitImport`).

**Fora do Plano 5 (YAGNI):** agregações de dashboard (somas por categoria/mês) — Plano 6 agrega
sobre `transactionsQuery`. Se exigir performance, vira view/RPC depois.

## 5. Data flow — `commitImport` (a peça central, agora **atômica**)

A categorização roda em **TS** (as regras vivem no `@lastro/categorizer`); a **escrita
multi-tabela** roda numa **função Postgres (RPC)**, ganhando atomicidade real:

```
ParsedTransaction[]  (de @lastro/importers)
  │  ── em TypeScript ──
  ├─ carrega regras (queryFn de rules) + categorias do usuário
  ├─ categorize(desc, regras) por item        → resolve nome → category_id (null se sem match)
  │
  │  ── uma chamada RPC, transação real do Postgres ──
  └─ rpc('commit_import', { account_id, format, file_name, items[] })
        BEGIN
          insert into imports (...) returning id;
          insert into transactions (...) select from unnest(items)
            on conflict (user_id, dedup_hash) do nothing;   -- dedup do banco
          return jsonb { import_id, inserted, duplicates };
        COMMIT  (implícito na função)
```

- **Atomicidade:** se qualquer insert falhar, a função inteira reverte — **sem `imports`
  órfão**. (O design anterior, com duas chamadas separadas do client, não garantia isso.)
- **Nova migration** `00NN_commit_import_fn.sql` cria a função `security invoker` (respeita RLS;
  usa `auth.uid()` para `user_id`). Pertence ao Plano 5 porque é específica deste fluxo.
- **Dedup em duas camadas:** `dedup_hash` (FNV-1a) vem do importers; `on conflict` do banco é a
  rede final. `inserted` vs `duplicates` derivado do que a função efetivamente gravou.
- **Mapeamento categoria → category_id:** o categorizer devolve o *nome*; o TS resolve para o
  `id` usando as categorias do usuário antes de mandar o lote pra RPC. Sem match → `null`
  ("Sem categoria"; usuário corrige depois e o aprendizado registra a regra).

## 6. Tratamento de erros

- `unwrap<T>({ data, error }): T` lança `DataError` (com `code`/`message`/`details` do Postgres)
  quando há `error`; senão devolve `data`. Vale tanto para `.from()` quanto para `.rpc()`.
- Input externo (`CommitImportInput`) validado com Zod na borda antes de tocar o banco.
- Sem `try/catch` espalhado: erro vira exceção e sobe; Web/Mobile tratam via `onError` do
  TanStack.

## 7. Testes

**Integração contra o Supabase local** (Docker), espelhando o PR #2:

1. provisiona usuário de teste via `service_role` (`auth.admin.createUser`);
2. faz login → `DataClient` autenticado;
3. roda queries/mutations reais **através do RLS**, cobrindo caminho feliz + isolamento entre
   usuários.

**RPC `commit_import`:** teste **pgTAP** dedicado (em `supabase/tests/`) garantindo atomicidade
(falha → rollback total) e a contagem `inserted`/`duplicates`.

**Orquestração pura** do `commitImport` (mapeamento nome→id, categorização, montagem do lote) +
as **chaves de cache** (`keys.ts`): **testes unitários rápidos** com fake de `DataClient`, sem
Docker.

Ver armadilhas de Windows na memória de ambiente (pnpm no PATH, CRLF/LF, worktree).

## 8. Dependências e configuração

- **Workspace:** `@lastro/shared`, `@lastro/importers`, `@lastro/categorizer`.
- **Externas:** `@supabase/supabase-js`, `@tanstack/query-core` (sem `react`).
- **Schema:** nova migration `00NN_commit_import_fn.sql` (RPC) + teste pgTAP.
- **Scripts:** novo `db:types` na raiz.

## 9. Riscos e decisões em aberto (resolver no plano)

- **CI com Supabase:** confirmar se o job de DB do PR #2 já sobe Supabase para os testes de
  integração/pgTAP, ou se precisa de passo novo. Fallback: separar unitários (sempre rodam) dos
  de integração (gated por disponibilidade do banco).
- **`database.types.ts` versionado:** commitado para consumidores fazerem typecheck sem Docker;
  regerado via `db:types` quando o schema mudar (a nova RPC entra nos tipos).
- **`mutationOptions` no query-core:** confirmar a API estável no `@tanstack/query-core` da
  versão fixada; se necessário, expor um objeto de config simples em vez do helper.
