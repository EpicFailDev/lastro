# Aprendizados da comunidade — Actual, Maybe e Firefly III

- **Data:** 2026-06-16
- **Autor:** Guilherme (com Claude)
- **Objetivo:** Estudar três apps de finanças open source maduros e extrair, para o Lastro,
  os padrões que valem **copiar**, **adaptar** ou **ignorar conscientemente**. Referência viva
  para os Planos 5 (queries), 6 (web) e 7 (mobile), e para a evolução do `importers`/`categorizer`.
- **Repos estudados:**
  - [`actualbudget/actual`](https://github.com/actualbudget/actual) — TS, local-first. O mais transferível.
  - [`maybe-finance/maybe`](https://github.com/maybe-finance/maybe) — Rails. Modelagem de domínio e UX (arquivado/estável).
  - [`firefly-iii/firefly-iii`](https://github.com/firefly-iii/firefly-iii) — PHP/Laravel. Motor de regras e partida dobrada.

> **Regra de ouro deste estudo:** não copiar código — abstrair o *padrão*. Cada um resolve
> problemas que o Lastro **vai** ter (dedup robusto, regras componíveis, saldo histórico,
> UX de confiança). Vários "recursos" deles são respostas a problemas que **não temos**
> (CRDT, multi-moeda, partida dobrada plena) — esses estão marcados como _ignorar_.

---

## 0. Resumo executivo (o que mudar e quando)

| # | Abstração | De onde | Quando | Esforço |
|---|---|---|---|---|
| 1 | **Dedup em 3 camadas** (FITID → fingerprint → fuzzy ±dias) | Actual | 🟢 Agora (migration + importers) | Médio |
| 2 | **Capturar `FITID` do OFX** como `imported_id` | Actual + Firefly | 🟢 Agora (importers) | Baixo |
| 3 | **`imported_description`** (texto cru do banco) ao lado da descrição resolvida | Actual + Firefly | 🟢 Agora (migration) | Baixo |
| 4 | **Transferência como tipo de 1ª classe** (excluída de receita/despesa) | os 3 | 🟢 Agora (migration) | Médio |
| 5 | **Saldo diário materializado** + recálculo *forward* por range | Maybe | 🟢 Agora (migration + função) | Médio |
| 6 | **Motor de regras como dados** (condições/ações com `order`, AND/OR, `stop`) | Firefly + Actual | 🟡 Categorizer v2 | Alto |
| 7 | **Aprendizado por consenso** (≥3 das N últimas) em vez de 1ª correção | Actual | 🟡 Categorizer v2 | Médio |
| 8 | **Helper `Trend`** (vs. mês anterior, cor por favorabilidade, sem `NaN%`) | Maybe | 🟡 Dashboard (Plano 6) | Baixo |
| 9 | **Peso percentual por categoria** na própria query + views materializadas | Maybe | 🟡 Dashboard (Plano 6) | Baixo |

**Não fazer (over-engineering pro nosso escopo):** partida dobrada plena · RuleGroups ·
multi-moeda · Levenshtein/fuzzy de nome · CRDT/mapping-tables do Actual · QIF/CAMT · budgets.

A maior única melhoria de robustez: **substituir o hash de dedup único pelo modelo em camadas
do Actual** — nosso hash atual duplica quando a data muda entre extrato provisório e definitivo.

---

## 1. Actual Budget (`actualbudget/actual`)

App de orçamento local-first em TS. Como compartilha linguagem conosco, é o mais direto de abstrair.

### 1.1 Dinheiro

- Inteiro escalado (centavos), `decimalPlaces` configurável. `amountToInteger` = `Math.round(x * 100)`.
- Guard `safeNumber` com bound `2**51 - 1` (abaixo do `MAX_SAFE_INTEGER`, deixa folga p/ somatórios).
- Três tipos nominais explícitos: `Amount` (float), `CurrencyAmount` (string), `IntegerAmount` (centavos)
  — a fronteira float↔int fica sempre visível.
- Parsing de entrada (`looselyParseAmount`) **separado** do parsing estrito.

**Pro Lastro:** já acertamos no fundamental (centavos inteiros, negativo = despesa). Vale **copiar**
os 3 type-aliases nominais no `shared` (documentam a fronteira) e o guard `safeNumber`. **Adaptar**
o `looselyParseAmount` ao padrão BR (`1.234,56` e `(1.234,56)` negativo) — crítico no import de CSV.
**Atenção ao rounding:** `Math.round(-2.5) = -2` (arredonda para +∞), o que enviesa negativos — se um
dia ratear centavos, use `Math.round(Math.abs(x)) * sign` ou banker's rounding.

### 1.2 Import

- Roteamento **só por extensão** (`.ofx/.qfx`, `.csv`, `.qif`, `.xml`=CAMT). **Sem lógica por banco.**
- OFX é SGML mal-formado: tenta XML direto e, no catch, `sgml2Xml()` sintetiza tags de fechamento.
  Extrai `DTPOSTED`, `TRNAMT`, `NAME`/`MEMO`, e **`FITID` → `imported_id`**.
- CSV: delimiter **não** auto-detectado (vem do usuário). Mapeamento de colunas é client-side, por
  heurística (nome do header + regex de valor), e **persistido por conta** (`csv-mappings-${accountId}`).

**Pro Lastro:** **copiar** a arquitetura de duas camadas (parsing cru puro no `importers`; mapeamento
na UI) e **persistir o perfil de import por conta** (delimiter, colunas, formato de data, regra de sinal)
numa tabela `import_profiles`. **Copiar** a estratégia OFX SGML→XML. **Ignorar** QIF/CAMT no MVP.

### 1.3 Dedup (a maior oportunidade) — `server/accounts/sync.ts`

`reconcileTransactions` → `matchTransactions`, em **três passadas da maior p/ a menor fidelidade**, com
`Set hasMatched` garantindo casamento 1-para-1:

1. **Exato por `imported_id` (FITID) + conta.** Única chave estável. Inclui tombstoned (não re-cria deletada).
2. **Fuzzy** (se 1 falhou): conta + `amount` **exato** + `date` **±7 dias**, ranqueado por proximidade de data;
   sub-passada por mesmo payee, fallback sem payee.
3. `strictIdChecking`: não funde duas transações que **ambas** têm FITID distinto.

Percepção contra-intuitiva: o Actual **prefere fuzzy a hash de campos**, porque a data reportada muda
entre o extrato provisório e o definitivo — um hash de `(data, valor, descrição)` **quebra** nesse caso.

**Pro Lastro — adotar o modelo de camadas mantendo o melhor dos dois mundos:**
1. **Camada 1 — FITID:** capturar e dedupe por `(account_id, imported_id)` exato.
2. **Camada 2 — nosso hash FNV-1a** como fallback p/ CSV sem FITID, **tirando a data de dentro do hash**
   (hashear só `amountCents + descrição normalizada`).
3. **Camada 3 — fuzzy:** mesma conta + valor exato + `occurred_at` em **±3 dias**, `Set hasMatched` 1-para-1.

Copiar também: `strictIdChecking` e o merge não-destrutivo no UPDATE (`existing.x || novo.x`).

### 1.4 Regras / aprendizado — `server/rules/` + `transaction-rules.ts`

- `Rule { stage: pre|null|post, conditionsOp: and|or, conditions[], actions[] }`. **Sem peso manual.**
- Prioridade = **score de especificidade computado** (`rankRules`): op mais específico vence (`is`=10,
  `oneOf`=9, `contains`=0; regra só-de-igualdade ×2); empate por id (determinístico). Mais específica
  roda **depois** → seu `set` vence.
- Operadores: `is, isNot, oneOf, contains, matches(regex), gt/lt, isapprox, isbetween, hasTags...`. Tudo
  `toLowerCase` no início (case-insensitive). Sem Levenshtein em lugar nenhum.
- **Aprendizado automático** (`updateCategoryRules`): para o payee, olha as **5 transações mais recentes**;
  se uma categoria aparece **≥3 das 5**, cria/atualiza regra `is payee → set category`. Flag
  `payees.learn_categories` permite opt-out por payee.
- Renomear payee é só uma **regra pre-stage** `oneOf imported_payee → set payee` (acumula no `oneOf`).

**Pro Lastro:** **adotar o aprendizado por consenso (≥3 das N últimas)** em vez de criar regra na 1ª
correção — mata regra-lixo de clique acidental (maior ROI aqui). **Considerar** trocar peso-manual por
score-de-especificidade (se o usuário nunca for editar pesos). **Adicionar** os operadores `oneOf` e
`amount_more/less`. **Ignorar** Levenshtein — normalização determinística + `contains`/`oneOf` cobrem.

### 1.5 Schema — `aql/schema/index.ts`, `models.ts`

- IDs TEXT/UUID; **soft-delete via `tombstone` em toda tabela** (necessário pro CRDT).
- `transactions`: além do óbvio, guarda `imported_id`, `imported_payee` (cru), `transfer_id`,
  `cleared`/`reconciled`, `is_parent`/`is_child` + `parent_id` (splits self-referente).
- Regras = **JSON em coluna** (não tabela normalizada).

**Pro Lastro (Postgres, não CRDT):** **copiar** `imported_id` + `imported_description`, splits via
`parent_id` self-referente + flags, e `conditions`/`actions` como **`jsonb`**. **Divergir conscientemente:**
manter `timestamptz` UTC (não o INTEGER `yyyyMMdd` do Actual), `uuid` nativo, e soft-delete via
`deleted_at` **só** pela razão do dedup (não re-importar deletada). **Ignorar** AQL/views, CRDT e
mapping-tables — o Supabase já resolve.

---

## 2. Maybe (`maybe-finance/maybe`)

Rails, arquivado/estável. Interessa **modelagem e UX**, não código.

### 2.1 Saldo ao longo do tempo — `app/models/balance/`

- **Saldos diários materializados** numa tabela `balances` (não calculados on-the-fly) → dashboard e
  gráficos viram leitura pura.
- `forward_calculator`: do passado p/ o presente, partindo de uma **âncora de abertura**, running balance
  `fim = início + inflows − outflows`. Usado para contas manuais/importadas.
- `reverse_calculator`: do presente p/ o passado (parte do saldo atual reportado pelo banco). Para contas
  conectadas (não é nosso caso no v1).
- **Transações retroativas:** não há recálculo incremental — o sync **re-materializa o range inteiro**
  da conta (apaga e re-insere). Simples e à prova de *drift*.
- LOCF (Last Observation Carried Forward): dias sem movimento herdam o último saldo.

**Pro Lastro:** simplificar (sem cash/non-cash, sem holdings). Tabela `account_daily_balances
(account_id, date, balance, currency)`, PK `(account_id, date)`. Âncora `opening_balance`/`opening_date`
na conta. Só o calculador **forward**. Em qualquer alteração (inclusive retroativa), **re-materializar o
range** numa função `plpgsql` — não tentar incremental. Gráfico via LOCF com `generate_series` +
`LEFT JOIN LATERAL`.

### 2.2 Dashboard — `income_statement.rb`, `balance_sheet.rb`

- Net worth = `assets − liabilities`, série histórica somando os balances diários materializados.
- Income/expense e gasto por categoria em **query objects cacheados** (`Totals`, `CategoryStats`),
  agrupando por categoria (com pai/filho) e calculando o **peso percentual**: `categoria / total * 100`.
- Cash flow visualizado como **Sankey** (income → caixa → expense, com *surplus*).
- Cache keys incluem `entries_cache_version` → mudança em transações invalida o cache.

**Pro Lastro:** com a tabela de saldos materializada, evolução mensal é `GROUP BY date_trunc('month', date)`.
Calcular `weight_pct` **na própria query** (`sum * 100 / sum() over ()`). Modelar `parent_category_id`
p/ rollup. Criar **views materializadas** (`monthly_category_spending`) com refresh no fim do import.
Expor `{ income, expense, surplus }`.

### 2.3 UX de confiança — `trend.rb`

Value object único que padroniza **toda** comparação temporal:

- `value = atual − anterior`; `percent = (change/anterior) * 100` (1 casa).
- **Casos de borda explícitos:** ambos zero → `0.0`; anterior zero → `∞` (mostra "＋∞", nunca `NaN%`).
- `direction` em três estados: `up` / `down` / `flat`.
- **Cor por favorabilidade, não direção:** gasto que cai = **verde** (mesmo sendo "down"); cada métrica
  declara qual direção é boa. Evita "tudo que sobe é verde".
- Sparklines compactas, barras de peso percentual, seletor de período global.

**Pro Lastro:** criar `Trend(atual, anterior, { favorableDirection })` → `{ delta, pct, direction, color,
icon }` em TS, tratando as bordas no helper (nunca vaza `NaN`/`Infinity`). Usar em **todo** card. Sempre
mostrar "vs. mês passado". Alinha direto com o princípio de produto "calma e confiança".

---

## 3. Firefly III (`firefly-iii/firefly-iii`)

PHP/Laravel. Tem um dos motores de regras mais maduros do open source financeiro.

### 3.1 Motor de regras — `app/TransactionRules/Engine/SearchRuleEngine.php`

- Hierarquia `RuleGroup → Rule (order, strict, active, stop_processing) → Trigger[] / Action[]`, todos
  com `order`.
- **Strict (AND):** todos os triggers casam juntos. **Non-strict (OR):** qualquer trigger dispara.
- **`stop_processing` no nível da regra:** "a primeira regra que casar manda, pare aqui".
- Triggers e actions são **dados** `(type, value, order)`, não código. Adicionar capacidade = inserir
  linha num registry. Sufixo-por-operação: `description_contains/is`, `amount_more/less/is`, `date_*`,
  flags sem contexto (`has_no_category`, `has_any_tag`). ~22 actions (`set_category`, `add_tag`, ...).
- O Firefly **não aprende sozinho** — é 100% manual.

**Pro Lastro:** **adotar** `rules`/`rule_conditions`/`rule_actions` como tabelas (`order`, `active`,
`stop_processing`), com `match_all` (AND/OR). Triggers enxutos + o flag de ouro `has_no_category`
("categorize tudo que ainda está sem categoria"). **Nosso diferencial:** combinar regra explícita
(prioridade) + classificador aprendido (fallback) — melhor que o Firefly (manual) e que o Actual.
**Ignorar:** os 150 operadores, RuleGroups (um `order` global basta), `stop_processing` no nível da action.

### 3.2 Import — Data Importer

- Config de import (roles das colunas + mapeamentos + dedupe) salva num **JSON por banco**, reutilizável.
- Dedup em dois métodos: **content hash** (do estado original, antes das regras) e **identifier-based**
  (coluna mapeada como `external-id`, mais robusto).

**Pro Lastro:** confirma o tópico do Actual — **ID externo (FITID) é melhor que hash**; persistir perfil
de import por banco/conta. Não construir mapping valor-a-valor separado: o **motor de regras** já resolve
isso no pós-import (um lugar só).

### 3.3 Modelo de dados — partida dobrada (a pergunta-chave)

- `TransactionJournal` tem exatamente **2 `Transaction`** (source negativa, destination positiva, somam 0).
  O **tipo** (withdrawal/deposit/transfer) sai dos tipos das contas das pernas. Categoria/tags ficam no
  journal. Transferência = journal com duas pernas *asset* → não polui receita nem despesa.

**Pro Lastro — o Lastro deveria adotar double-entry no v1? NÃO (plena), mas SIM o pedaço que importa:**
o custo do double-entry não é o schema (2 linhas é fácil) — é tudo **em volta** (toda query de relatório
vira JOIN + filtro por tipo de conta + sinal; o import só te dá UM lado). Para "controle de gastos
pessoais", o ponto certo é **single-entry + transferência como tipo especial**: marcar um par de
transações entre contas próprias como transferência interna, **excluída dos relatórios de receita/despesa**.
Captura ~95% do benefício com ~10% do custo. Reavaliar só se o Lastro virar contabilidade de verdade.

---

## 4. Impacto no schema e nos próximos planos

Ver o plano concreto em [`plans/2026-06-16-evolucao-schema-comunidade.md`](../plans/2026-06-16-evolucao-schema-comunidade.md).
Em resumo, novas migrations (a partir de `0011`):

- `transactions`: `+ imported_id text`, `+ imported_description text`, `+ transfer_id uuid`,
  `+ type text` (`expense|income|transfer`). Índice único parcial `(account_id, imported_id)
  where imported_id is not null`.
- `import_profiles (user_id, account_id, config jsonb)` — perfil de import por conta.
- `account_daily_balances (account_id, date, balance_cents, currency)` + função `plpgsql` de
  re-materialização forward por range; `accounts.opening_balance_cents` / `opening_date`.
- (Categorizer v2) `rules` / `rule_conditions` / `rule_actions` substituindo `category_rules`, com
  aprendizado por consenso.

**Plano 5 (`shared`/queries):** ao gerar o cliente tipado, rodar `supabase gen types typescript` como
fonte da verdade e expor queries que já entendem `transfer_id`/`type` (excluir transferências dos
agregados de gasto) e leem `account_daily_balances` para o dashboard.

---

## 5. Arquivos-âncora (para consulta ao implementar)

**Actual** (`actualbudget/actual`, branch master):
- Dinheiro: `packages/loot-core/src/shared/util.ts`
- Import: `.../server/transactions/import/parse-file.ts`, `ofx2json.ts`
- Dedup: `.../server/accounts/sync.ts` (`reconcileTransactions`/`matchTransactions`)
- Regras/aprendizado: `.../server/rules/{condition,rule,rule-utils}.ts`,
  `.../server/transactions/transaction-rules.ts`, `.../server/accounts/payees.ts`
- Schema: `.../server/aql/schema/index.ts`, `.../server/models.ts`

**Maybe** (`maybe-finance/maybe`, `app/models/`):
- `balance/{base_calculator,forward_calculator,reverse_calculator,materializer}.rb`,
  `account/syncer.rb`, `income_statement.rb`, `balance_sheet.rb`, `trend.rb`

**Firefly III** (`firefly-iii/firefly-iii`):
- Engine: `app/TransactionRules/Engine/SearchRuleEngine.php`
- Catálogos: `config/search.php` (triggers), `config/firefly.php` (actions)
- Modelos: `app/Models/{Rule,RuleTrigger,RuleAction,TransactionJournal,Transaction}.php`
</content>
</invoke>
