# Design — Plano 5: pacote `@lastro/data`

> Camada de acesso a dados do Lastro: cliente Supabase tipado + funções async puras
> que ligam os pacotes existentes (`importers`, `categorizer`, `shared`) ao banco.
> Consumida por Web (Plano 6) e Mobile (Plano 7) via TanStack Query.

## 1. Objetivo e fronteira

Entregar **`@lastro/data`**: um pacote de **funções async puras de acesso a dados** sobre um
**cliente Supabase tipado**. O pacote é a fonte única de verdade de *como o app fala com o banco*.

**Decisão de fronteira:** o pacote **não** inclui hooks de React/TanStack Query. Os hooks entram
em Web/Mobile (Planos 6–7), onde existe consumidor real. Motivos:

- mantém o pacote testável e desacoplado de React (roda em Node nos testes);
- evita boilerplate especulativo (YAGNI) — ambos os clientes usam React, mas a forma exata
  dos hooks depende de decisões de UI ainda não tomadas;
- as funções puras são o contrato estável; hooks são um wrapper fino por cima.

## 2. Cliente tipado

- **Factory:** `createDataClient(url: string, anonKey: string): DataClient` onde
  `DataClient = SupabaseClient<Database>`. Toda função de dados recebe o `DataClient` como
  **primeiro argumento** (injeção de dependência) — sem singleton global, fácil de testar.
- **Tipos do banco gerados:** `Database` é gerado do schema local via
  `supabase gen types typescript --local`, salvo em `packages/data/src/database.types.ts`.
  Novo script de raiz `db:types`. Assim os tipos seguem as migrations automaticamente — **uma
  fonte de verdade só (o SQL)**.
- **Tipos de domínio:** `Account`, `Category`, `Transaction`, `NewTransaction`, etc. derivados
  dos tipos `Row`/`Insert` gerados (ex.: `type Account = Database['public']['Tables']['accounts']['Row']`).
- **Zod só nas bordas de entrada** que precisam validar dados externos (o input de `commitImport`).
  Leituras do nosso próprio banco confiam no tipo gerado — não revalidamos o que o Postgres garante.

## 3. Módulos (um arquivo = um propósito)

| Arquivo | Funções |
|---|---|
| `client.ts` | `createDataClient` |
| `errors.ts` | `DataError`, helper `unwrap` |
| `database.types.ts` | tipos `Database` gerados (não editar à mão) |
| `types.ts` | tipos de domínio + schemas Zod das bordas |
| `accounts.ts` | `listAccounts`, `createAccount`, `archiveAccount` |
| `categories.ts` | `listCategories` (sistema + usuário), `createCategory` |
| `transactions.ts` | `listTransactions(filtros)`, `insertManualTransaction`, `updateTransactionCategory`, `deleteTransaction` |
| `rules.ts` | `listRules`, `createRule`, `deleteRule` |
| `imports.ts` | `commitImport` (orquestração — ver §5) |
| `index.ts` | re-exports públicos |

### Assinaturas principais

```ts
// accounts
listAccounts(c: DataClient): Promise<Account[]>;
createAccount(c: DataClient, input: NewAccount): Promise<Account>;
archiveAccount(c: DataClient, id: string): Promise<void>;

// categories
listCategories(c: DataClient): Promise<Category[]>; // user_id = NULL (sistema) + do usuário
createCategory(c: DataClient, input: NewCategory): Promise<Category>;

// transactions
type TransactionFilter = { accountId?: string; from?: string; to?: string };
listTransactions(c: DataClient, filter?: TransactionFilter): Promise<Transaction[]>;
insertManualTransaction(c: DataClient, input: NewManualTransaction): Promise<Transaction>;
updateTransactionCategory(c: DataClient, id: string, categoryId: string | null): Promise<void>;
deleteTransaction(c: DataClient, id: string): Promise<void>;

// rules
listRules(c: DataClient): Promise<CategoryRuleRow[]>;
createRule(c: DataClient, input: NewRule): Promise<CategoryRuleRow>;
deleteRule(c: DataClient, id: string): Promise<void>;

// imports
type CommitImportInput = {
  accountId: string;
  format: 'csv' | 'ofx';
  fileName?: string;
  transactions: ParsedTransaction[]; // de @lastro/importers
};
type CommitImportResult = { importId: string; inserted: number; duplicates: number };
commitImport(c: DataClient, input: CommitImportInput): Promise<CommitImportResult>;
```

## 4. Escopo de v1 e o que fica de fora

**Dentro:** contas (listar/criar/arquivar), categorias (listar/criar), transações (listar com
filtro de conta/período, lançar manual, editar categoria, excluir), regras de categoria
(listar/criar/excluir) e o fluxo de importação (`commitImport`).

**Fora do Plano 5 (YAGNI):** agregações de dashboard (somas por categoria/mês). Ficam no Plano 6
— a Web agrega em cima de `listTransactions`. Se a performance exigir, vira uma view/RPC no
schema depois (mudança que pertence ao Plano 2, não a este).

## 5. Data flow — `commitImport` (a peça central)

Liga os três pacotes existentes ao banco numa transação lógica:

```
ParsedTransaction[]  (de @lastro/importers)
  │
  ├─ listRules(c)                          → regras do usuário
  ├─ categorize(desc, regras)  por item    → category_id (via @lastro/categorizer)
  ├─ insert em `imports`                    → importId (auditoria: formato, arquivo, contagem)
  ├─ upsert em `transactions`               → onConflict (user_id, dedup_hash), ignoreDuplicates
  │
  └─ retorna { importId, inserted, duplicates }
```

- **Dedup em duas camadas:** o `dedup_hash` (FNV-1a) já vem do importers; a constraint única
  `(user_id, dedup_hash)` do banco é a rede de segurança final. `inserted` vs `duplicates` é
  derivado das linhas que o upsert efetivamente gravou.
- **`user_id`:** resolvido internamente via `c.auth.getUser()`. As leituras são filtradas por
  RLS (`auth.uid()`); os inserts precisam preencher a coluna `not null`.
- **Mapeamento categoria → category_id:** o categorizer devolve o *nome* da categoria; o
  `commitImport` resolve o nome para o `id` usando as categorias do usuário (cache da chamada).
  Sem correspondência → `category_id = null` (fica "Sem categoria", o usuário corrige depois,
  alimentando o aprendizado).

## 6. Tratamento de erros

- O supabase-js retorna `{ data, error }`. Helper `unwrap<T>({ data, error }): T` lança
  `DataError` (com `code`/`message`/`details` do Postgres) quando `error` existe; senão devolve `data`.
- Inputs externos (`CommitImportInput`) validados com Zod na borda antes de tocar o banco.
- Sem `try/catch` espalhado: erro de banco vira exceção e sobe para o chamador (Web/Mobile
  tratam na camada de UI/React Query).

## 7. Testes

**Integração contra o Supabase local** (Docker), espelhando a confiança do PR #2:

1. provisiona um usuário de teste via `service_role` (`auth.admin.createUser`);
2. faz login → obtém um `DataClient` autenticado;
3. roda as queries reais **através do RLS**, validando tanto o caminho feliz quanto o
   isolamento entre usuários (um usuário não vê dados do outro).

A orquestração pura do `commitImport` (contagem de dedup, mapeamento nome→id, categorização)
também ganha **testes unitários rápidos** com um fake de `DataClient`, para feedback sem Docker.

Requer Docker Desktop rodando (`pnpm db:start`/`db:reset`). Ver armadilhas de Windows na memória
de ambiente do projeto (pnpm no PATH, CRLF/LF, `git worktree remove` com caminho longo).

## 8. Dependências e configuração

- **Workspace:** `@lastro/shared`, `@lastro/importers`, `@lastro/categorizer`.
- **Externa:** `@supabase/supabase-js`.
- **Scripts:** novo `db:types` na raiz (`supabase gen types typescript --local > packages/data/src/database.types.ts`).
- **CI:** os testes de integração exigem Supabase no pipeline — reusar/estender o job que o
  Plano 2 já configurou para os testes pgTAP, ou marcar os testes de integração como gated por
  disponibilidade do banco (decidir no plano de implementação).

## 9. Riscos e decisões em aberto (resolver no plano)

- **CI com Supabase:** confirmar se o job de DB do PR #2 já sobe Supabase para os testes de
  integração ou se precisa de passo novo. Fallback: separar testes unitários (sempre rodam) dos
  de integração (rodam quando há banco).
- **`database.types.ts` versionado:** commitamos o arquivo gerado (consumidores não precisam de
  Docker para typecheck) e regeramos via `db:types` quando o schema mudar.
