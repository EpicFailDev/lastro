# Design — Importador inteligente de extrato (pacote `importers`)

**Data:** 2026-06-16
**Status:** aprovado (brainstorming) — pronto para plano de implementação
**Escopo:** pacote `packages/importers` apenas. A UI do assistente de confirmação fica para
um plano futuro (junto de Web/Mobile).

## Problema

O usuário nem sempre envia um modelo padrão de extrato. Hoje o parser de CSV
(`detectAndParse` → `parseCsv`) **exige um `CsvTemplate` conhecido de antemão**: sem template,
ele lança erro; com template errado, importa valores/sinais incorretos calado.

Dois defeitos concretos, comprovados com exports reais do Nubank
(`NU_..._01JUN2026_15JUN2026.ofx` e `.csv`):

1. **Template do Nubank-Conta está descalibrado.** O código assume `delimiter: ';'` e
   `decimalSeparator: ','`, mas o export real é `Data,Valor,Identificador,Descrição` — vírgula
   como separador de coluna e **ponto** decimal (`15.00`). Resultado: o arquivo real **não
   importa** com o template atual.
2. **CSV e OFX compartilham o mesmo ID estável e ambos o ignoram.** O `Identificador` do CSV
   (`6a1ed812-…`) é exatamente o `FITID` do OFX. A dedupe atual é um hash FNV-1a de
   data+valor+descrição — frágil e sem usar o identificador externo, que é dedupe de verdade.

## Objetivo

Tornar o importador **agnóstico de formato e inteligente**: inferir o layout de um CSV
desconhecido por heurísticas determinísticas (client-side, sem ML/servidor), importar
automaticamente quando a confiança for alta, e expor um "mapeamento proposto + confiança" para
um assistente confirmar quando a confiança for baixa. Templates por banco deixam de ser
pré-requisito e viram apenas **atalho calibrado**.

Princípios herdados do projeto (não negociáveis): dinheiro em centavos inteiros; datas em
`YYYY-MM-DD`; **arquivo bruto nunca sai do cliente** (logo, nada de LLM/servidor no parsing);
TypeScript strict; lógica pura e testável.

## Arquitetura

A inteligência é uma camada **antes** do motor de parsing. O motor (`parseCsv`/`parseOfx`)
continua puro e "burro": recebe um layout pronto e produz transações. A novidade é que o layout
passa a ser **resultado** da análise, não pré-requisito.

```
conteúdo bruto
  └─ detectAndParse(content, opts?)
       ├─ OFX?  → parseOfx()                       → { status: 'parsed', result }
       └─ CSV?
            ├─ opts.template fornecido → parseCsv(template) → { status: 'parsed', result, layout }
            └─ senão → analyzeCsv(content) → CsvLayout + confidence + signals
                         ├─ confidence ≥ THRESHOLD → parseCsv(layout) → { status: 'parsed', ... }
                         └─ confidence <  THRESHOLD → { status: 'needs_confirmation', layout, headers, sampleRows }
```

### Unidades (cada uma com propósito único e testável)

| Unidade | O que faz | Depende de |
|---|---|---|
| `sniffDelimiter(content)` | escolhe `, ; \t \|` pela consistência de contagem de colunas | — |
| `detectHeader(rows)` | decide se a 1ª linha é cabeçalho (não-numérica) ou dados | — |
| `mapColumns(headers, rows)` | atribui papéis (date/amount/description/id) por sinônimos de cabeçalho e, em fallback, por conteúdo | `dates`, `money` (para sniff) |
| `detectDecimalSeparator(samples)` | `,` vs `.` a partir de amostras de valor, tratando milhar | — |
| `detectDateFormat(samples)` | `dd/mm/yyyy` \| `yyyy-mm-dd` \| `dd-mm-yyyy` | `dates` |
| `detectSign(amountSamples, ctx)` | confia no sinal se há +/−; marca `invertSign` se tudo positivo e parece fatura; baixa confiança se ambíguo | — |
| `analyzeCsv(content)` | orquestra as anteriores → `CsvLayout` + `confidence` + `signals[]` | todas acima |
| `parseCsv(content, layout)` | **inalterado em filosofia**; passa a ler `idColumn` quando presente | `money`, `dates`, `dedup` |
| `parseOfx(content)` | passa a extrair `FITID` → `externalId` | `money`, `dedup` |
| `detectAndParse(content, opts?)` | orquestrador; retorna `DetectResult` | tudo |

## Detecção de CSV (heurísticas)

- **Delimitador:** testa `, ; \t |`; vence o que dá contagem de colunas mais consistente entre
  as primeiras N linhas.
- **Cabeçalho:** 1ª linha sem nenhum campo numérico/data → cabeçalho; senão, dados sem cabeçalho.
- **Papel das colunas:**
  - 1º por **sinônimos de cabeçalho** (pt/en, case-insensitive, sem acento):
    - date: `data`, `date`, `posted`, `data da compra`, `data do lançamento`
    - amount: `valor`, `amount`, `montante`, `quantia`, `value`
    - description: `descrição`, `descricao`, `description`, `title`, `histórico`, `historico`, `memo`, `lançamento`, `estabelecimento`
    - id: `identificador`, `id`, `fitid`, `id da operação`, `id da operacao`, `transaction id`
  - 2º por **conteúdo** (quando sem cabeçalho ou ambíguo): coluna que parseia como data = date;
    como dinheiro = amount; UUID/número longo e altamente único = id; maior texto restante =
    description.
- **Separador decimal:** inferido das amostras (`15,00`→vírgula; `15.00`→ponto), removendo o
  separador de milhar oposto.
- **Formato de data:** detectado por amostra. Inclui **`dd-mm-yyyy`** (Mercado Pago, registrado
  nas notas e ainda não suportado pelo `dates.ts`).
- **Sinal:** se a coluna de valor tem positivos **e** negativos → confia no sinal. Se é tudo
  positivo e o conjunto parece fatura de cartão → `invertSign`. Caso ambíguo → derruba a
  confiança (vai para confirmação).
- **`confidence` (0–1):** sobe quando papéis vêm de cabeçalho reconhecido; cai quando vêm de
  adivinhação por conteúdo ou quando o sinal é ambíguo. `signals[]` guarda motivos legíveis
  ("delimitador `,` por consistência"; "coluna Valor por cabeçalho"; "sinal ambíguo: tudo
  positivo") — usados pelo assistente e pelos testes.
- **`THRESHOLD`:** constante única e documentada (proposta inicial: `0.8`), ajustável por teste.

## Dedupe por identificador externo

`ParsedTransaction` ganha `externalId?: string` (CSV `Identificador`; OFX `FITID`). A chave de
deduplicação passa a ter precedência:

- tem `externalId` → chave = `ext:<externalId>` (estável, à prova de reimportação)
- não tem → mantém o `hash:<fnv>` atual (data+valor+descrição normalizada)

`makeDedupHash` continua existindo para o fallback. Acrescentamos `dedupKey(t)` que aplica a
precedência. Benefício: importar o mesmo período em **OFX e CSV** não duplica, pois ambos
carregam o mesmo UUID.

> Decisão: manter `dedupHash` no schema (compat) **e** adicionar `externalId`. A camada de
> persistência (Plano 5) usará `dedupKey` como identidade lógica.

## Contrato exposto

```ts
export type CsvLayout = {
  name?: string;            // nome amigável do banco, quando reconhecido por assinatura
  delimiter: string;
  hasHeader: boolean;
  dateColumn: string;       // nome (com header) ou índice serializado (sem header)
  amountColumn: string;
  descriptionColumn: string;
  idColumn?: string;        // novo
  dateFormat: 'dd/mm/yyyy' | 'yyyy-mm-dd' | 'dd-mm-yyyy';
  decimalSeparator: ',' | '.';
  invertSign?: boolean;
  confidence: number;       // 0..1
  signals: string[];        // motivos legíveis
};

export type DetectResult =
  | { status: 'parsed'; result: ImportResult; layout?: CsvLayout }
  | { status: 'needs_confirmation'; layout: CsvLayout; headers?: string[]; sampleRows: string[][] };
```

`CsvTemplate` (atual) permanece como o subconjunto "config manual"; `CsvLayout` é o
superconjunto inferido. `parseCsv` aceita ambos (lê os mesmos campos). Depois que o usuário
confirma/corrige no assistente (UI futura), a app só chama `parseCsv` com o layout ajustado.

## Templates como atalho calibrado

- **Nubank-Conta** recalibrado com o export real: `delimiter: ','`, `decimalSeparator: '.'`,
  `dateFormat: 'dd/mm/yyyy'`, colunas `Data`/`Valor`/`Descrição` + `idColumn: 'Identificador'`,
  sinal confiável (sem `invertSign`).
- **Reconhecimento por assinatura de cabeçalho:** se o conjunto de cabeçalhos casar com um
  template conhecido, `analyzeCsv` retorna `name` amigável e confiança alta direto.
- **Mercado Pago** permanece marcado honestamente como **não calibrado** até haver export real
  (a data `dd-mm-yyyy` e o `ID da operação` já ficam suportados pela detecção genérica).

## Testes e privacidade

- **Privacidade (crítico):** o repo é público. **Não** comitar OFX/CSV crus (têm nome, conta,
  CPF mascarado). Criar fixtures **anonimizadas** em `packages/importers/src/__fixtures__/`
  (mesma estrutura, dados falsos) derivadas dos arquivos reais.
- **Casos de teste (golden):**
  - detecção de delimitador (`,` vs `;` vs `\t`), separador decimal e formato de data
    (incl. `dd-mm-yyyy`);
  - mapeamento por cabeçalho **e** por conteúdo (sem cabeçalho);
  - extração de `externalId` no CSV e no OFX;
  - **dedupe cruzado OFX↔CSV** do mesmo período resultando em 1 transação por UUID;
  - sinal ambíguo (fatura tudo-positiva) caindo em `needs_confirmation`;
  - regressão do bug: o export real do Nubank-Conta passa a importar corretamente.

## Fora de escopo (YAGNI nesta rodada)

- UI do assistente de confirmação (plano futuro com Web/Mobile).
- ML/embeddings; qualquer processamento server-side do arquivo bruto.
- Detecção de gastos recorrentes (subprojeto separado — ver spec próprio, em pesquisa).
- Suporte a PDF (formato frágil; fora do MVP, conforme notas).

## Riscos

- **Detecção de sinal** é o ponto mais frágil; mitigado por confiança baixa → confirmação.
- **Heurística de conteúdo** pode errar em CSVs minúsculos (1–2 linhas); mitigado por exigir
  amostra mínima e cair em confirmação quando insuficiente.
