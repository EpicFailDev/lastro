# Design — Detecção de gastos recorrentes (pacote `recurrence`)

**Data:** 2026-06-16
**Status:** aprovado (brainstorming) — pronto para plano de implementação
**Escopo:** pacote novo `packages/recurrence`. Camada de análise pura sobre transações já
importadas; não toca em `importers` nem em UI. A apresentação no dashboard fica para os planos
de Web/Mobile.

## Problema e objetivo

O usuário quer que o app reconheça **automaticamente** despesas recorrentes (aluguel, internet,
assinaturas, contas mensais) "igual ao Nubank". Objetivo: a partir de `ParsedTransaction[]`,
detectar **séries recorrentes** — agrupando por comerciante mesmo com texto variável, inferindo
a periodicidade, prevendo a próxima ocorrência e lidando com variação de preço e cancelamento.

**Ressalva de fontes (honestidade intelectual):** a pesquisa NÃO encontrou fonte primária do
algoritmo interno do Nubank, Mint ou YNAB. O design abaixo implementa o **padrão de engenharia
mainstream** comprovadamente usado no setor, documentado em fontes primárias (paper BBVA/ACM
ICAIF'24, patentes USPTO Yodlee/Capital One/Mastercard, engenharia da Plaid/Ntropy). Não é "o
algoritmo do Nubank"; é a abordagem que o setor usa e que dá para fazer melhor com calibração
para dados brasileiros.

Princípios herdados (não negociáveis): **determinístico, 100% client-side, sem ML/servidor**
(coerente com "arquivo bruto nunca sobe"); dinheiro em centavos inteiros; datas `YYYY-MM-DD`;
TypeScript strict; unidades puras e testáveis.

## Fundamentação (pesquisa verificada)

Pipeline determinístico de 3 fases, convergente entre as fontes:

1. **Agrupar por comerciante com fuzzy matching** — nunca igualdade exata, porque a descrição
   varia. k-shingles + similaridade de Jaccard com limiar (~0.35). *(Yodlee US10902365B2; Plaid
   "description + amount + cadence".)*
2. **Detectar periodicidade pela mediana dos intervalos** (delta-t) entre transações
   consecutivas, classificada em buckets discretos. Tolerância de data **escala com o período**
   (±1–2 dias semanal, ±5 dias mensal). *(BBVA/ACM ICAIF'24; Mastercard US11392953B2.)*
3. **Prever a próxima** somando o período à última data; validar por holdout, tolerando faltas
   via "allowed missed" (ex.: 2 de 3). *(Capital One US11144935B2.)*

**Lição #1 de produção (verificada 3-0, múltiplas fontes):** matching de intervalo fixo/exato é
insuficiente — meses variam de tamanho, pagamentos atrasam, feriados quebram ciclos. Tudo exige
tolerância fuzzy em **data e valor**. Mesmo o algoritmo O(N·K) da Ntropy é declarado pelos
próprios autores inadequado sem fuzzy.

**Maturidade graduada (Plaid):** série "confirmada" só com **≥3 ocorrências**; com 2, é
"detecção antecipada" (provisória).

**Gap brasileiro (explicitado pela pesquisa):** as fontes usam descrições em inglês/EUA. Strings
BR — `PAG*Spotify`, `IFD*iFood`, prefixos de adquirente (Cielo/Rede/PagSeguro/Stone), ruído de
Pix — exigem **normalização própria antes do fuzzy**. É onde mora a eficácia real no nosso caso.

## Arquitetura

Pacote novo `packages/recurrence`. Entrada: lista de transações (formato `ParsedTransaction` do
`importers`, possivelmente já com categoria do `categorizer`). Saída: `RecurringSeries[]`.
Unidades puras, cada uma testável isoladamente:

| Unidade | O que faz | Base |
|---|---|---|
| `normalizeMerchant(desc)` | remove prefixo de adquirente (`PAG*`,`IFD*`,`MP*`,`MERCPAGO*`…), ruído de Pix, acentos, dígitos e datas → token canônico do comerciante | gap BR + Plaid tiered parsing |
| `shingleSimilarity(a, b)` | k-shingles (k=2 por padrão) + Jaccard ∈ [0,1] | Yodlee US10902365 |
| `groupByMerchant(txs)` | union-find clusterizando por `normalizeMerchant` + `shingleSimilarity ≥ JACCARD_THRESHOLD` | Yodlee + BBVA |
| `detectCadence(datas)` | mediana dos delta-t → bucket `{weekly, biweekly, monthly, quarterly, annual}`; rejeita se os intervalos não couberem num único bucket dentro da tolerância | BBVA ICAIF'24 |
| `checkAmountStability(valores)` | valor estável dentro de `AMOUNT_TOLERANCE_PCT`; detecta degrau persistente de preço (reajuste) vs outlier | patentes (tolerância de valor tunável) |
| `predictNext(série)` | próxima data = última + período; valida holdout + `ALLOWED_MISSED`; calcula `confidence` | Capital One US11144935 |
| `detectRecurring(txs, opts?)` | orquestra todo o pipeline → `RecurringSeries[]` | pipeline 3 fases |

## Contrato exposto

```ts
export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual';

export type RecurringStatus =
  | 'early_detection' // 2 ocorrências — provisória
  | 'confirmed'       // ≥3 ocorrências, em dia
  | 'late'            // passou de nextExpected + tolerância, dentro de ALLOWED_MISSED
  | 'ended';          // misses consecutivos > ALLOWED_MISSED — parar de prever

export type RecurringSeries = {
  merchant: string;           // token canônico (normalizeMerchant)
  displayName: string;        // melhor descrição legível observada
  cadence: Cadence;
  expectedAmountCents: number;// nível atual (último degrau estável)
  amountChanged: boolean;     // houve reajuste de preço ao longo da série
  status: RecurringStatus;
  confidence: number;         // 0..1
  firstSeen: string;          // YYYY-MM-DD
  lastSeen: string;
  nextExpected: string | null;// null quando status === 'ended'
  occurrences: number;
  transactionDedupKeys: string[]; // liga a série às transações-membro
};

export type DetectRecurringOptions = Partial<{
  jaccardThreshold: number;   // default 0.35
  minOccurrences: number;     // default 3 (matured)
  allowedMissed: number;      // default 2 (em janela de 3 previsões)
  amountTolerancePct: number; // default 0.15
  // tolerância de data por cadência (dias), default escalado por período
  dateTolerance: Partial<Record<Cadence, number>>;
}>;

export function detectRecurring(
  txs: ParsedTransaction[],
  opts?: DetectRecurringOptions,
): RecurringSeries[];
```

## Decisões de design (as "melhores decisões" pedidas)

- **Determinístico puro, client-side, sem ML.** Coerente com a privacidade do projeto e
  testável por golden files.
- **Pacote separado `recurrence`**, não dentro do `categorizer`: responsabilidades distintas
  (categoria ≠ série temporal). Cruzamento futuro (categoria "Moradia" + cadência mensal =
  forte sinal de aluguel) fica para depois, sem acoplar agora.
- **Limiares como constantes nomeadas e tunáveis** via `DetectRecurringOptions`, com defaults
  vindos da pesquisa (Jaccard 0.35; minOccurrences 3; allowedMissed 2; amountTolerance 15%),
  calibrados por teste.
- **Dicionário de normalização BR** versionado no pacote (`merchant-prefixes.ts`), fácil de
  estender conforme aparecem novos adquirentes/padrões.

### Resolução das perguntas em aberto da pesquisa

1. **Variação de preço vs série nova.** Uma transação que casa no cluster de comerciante **e**
   na janela de cadência, mas com valor fora de `amountTolerancePct`, é aceita na **mesma série**
   como **degrau de preço** apenas se o novo valor se mostrar **persistente** (a próxima
   ocorrência prevista também bate no novo nível). Nesse caso `expectedAmountCents` passa a ser
   o novo nível e `amountChanged = true`. Se o valor diferente for pontual (não persiste), é
   tratado como outlier e não entra na série. Não criamos série nova por mudança de preço.
2. **Cancelamento vs falha tolerada.** Enquanto os *misses* consecutivos (datas previstas sem
   transação dentro da tolerância) forem ≤ `allowedMissed`, a série fica `confirmed`/`late` e
   continua prevendo. Ao ultrapassar `allowedMissed` misses consecutivos, a série vira `ended`,
   `nextExpected = null` e paramos de prever. Reaparecendo depois, reabre como nova detecção.

## Testes (golden, dados reais anonimizados)

Reusa as fixtures **anonimizadas** do `importers` (mesma exigência de privacidade — repo
público) e adiciona séries sintéticas cobrindo:

- agrupamento fuzzy: `PAG*SPOTIFY` / `Spotify` / `SPOTIFY BR` caem no mesmo cluster;
- normalização BR: prefixos de adquirente e ruído de Pix removidos corretamente;
- cadência mensal com datas irregulares (dia 1, 3, 28) ainda detectada via tolerância;
- mês de tamanho variável e pagamento atrasado **não** quebram a série;
- maturidade: 2 ocorrências → `early_detection`; 3+ → `confirmed`;
- reajuste de preço persistente → `amountChanged = true`, série preservada;
- cancelamento: misses > `allowedMissed` → `ended`, `nextExpected = null`;
- previsão: `nextExpected` correto para semanal/quinzenal/mensal/anual.

## Fora de escopo (YAGNI nesta rodada)

- ML/embeddings; qualquer processamento server-side.
- Técnicas estatísticas de nicho das patentes (Lei de Benford / phase-space / Vector Strength) —
  documentadas mas explicitamente **não-mainstream**; não implementar.
- Cruzamento recorrência × categoria (sinal combinado) — follow-up.
- UI de gerenciador de assinaturas — planos Web/Mobile.

## Riscos

- **Normalização BR incompleta** gera clusters errados; mitigado por dicionário extensível +
  testes e por o Jaccard tolerar variações.
- **Histórico curto** (poucos meses por export) limita a maturidade; mitigado pelo
  `early_detection` (mostra candidatas provisórias em vez de esconder).
- **Limiares mal calibrados** geram falsos positivos/negativos; mitigado por serem tunáveis e
  cobertos por golden tests calibrados com dados reais.

## Fontes (verificadas por revisão adversarial)

- Patente Yodlee US10902365B2 — k-shingles + Jaccard, classificação de periodicidade em buckets.
- Patente Capital One US11144935B2 — pipeline cadência→predição→validação por holdout,
  `allowed missed`, tolerância de data.
- Patente Mastercard US11392953B2 — jitter de periodicidade, tolerância de data tunável.
- BBVA AI Factory / ACM ICAIF'24 (`10.1145/3677052.3698596`) — mediana de delta-t, tolerância
  por período, DBSCAN/MATRIX/GRAPH para desemaranhar padrões.
- Plaid — Recurring Transactions (streams, "matured ≥ 3 ocorrências", early detection) e parsing
  fuzzy de descrição em camadas.
- Ntropy — algoritmo de subsequências O(N·K) (pedagógico) e a lição de que fuzzy é obrigatório.

> Refutadas e descartadas na verificação (não usar): agrupamento por *merchant identifier* e
> periodicidade por "mesmo dia do mês" atribuídas à patente US10776789 (votos 0-3).
