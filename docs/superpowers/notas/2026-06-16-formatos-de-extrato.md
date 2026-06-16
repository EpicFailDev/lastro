# Achados de formato de extrato (dados reais — 2026-06-16)

Baseado em extratos reais (maio/2026) de Nubank e Mercado Pago, exportados em **PDF**.
Usar isto para calibrar os templates do pacote `@lastro/importers` quando tivermos os
exports em **CSV/OFX** (formato primário e confiável; PDF é frágil → candidato a v2).

## Nubank — Conta (PDF)

- Agrupado por dia, com cabeçalhos "Total de entradas / Total de saídas".
- Data no formato `01 MAI 2026` (dia, mês abreviado pt-BR, ano).
- **Sinal NÃO está na linha** — vem do grupo (entrada = +, saída = −). Cada linha traz só o
  valor absoluto (ex.: `14,55`).
- Descrição longa e multi-linha: tipo da operação ("Transferência enviada/recebida pelo Pix")
  + nome + CNPJ + banco + agência/conta.
- Valor pt-BR: milhar `.`, decimal `,` (ex.: `1.500,00`).
- ⚠️ Parsing de PDF aqui é frágil. Preferir o **OFX** do Nubank (app → Exportar extrato),
  que é padrão e traz `FITID` (ótimo para dedup).

## Mercado Pago — Conta (PDF)

- Tabela limpa: `Data | Descrição | ID da operação | Valor | Saldo`.
- Data no formato `01-05-2026` (**DD-MM-YYYY com traços**, não barras).
- **Valor com sinal explícito**: `R$ -90,00` (saída), `R$ 3,61` (entrada).
- **`ID da operação`** único por movimento (ex.: `156551952691`) → melhor chave de dedup
  que o hash; quando vier no CSV, usar como `externalId`.
- Descrições úteis para categorização (comerciante no texto).

## Melhorias de design a aplicar (quando houver CSV/OFX real)

1. **Dedup por id externo quando disponível:** OFX `FITID` e MP `ID da operação` → preferir a
   `makeDedupHash` apenas quando não houver id. Sugestão: `CsvTemplate.idColumn?` opcional e
   `parseOfx` usando `FITID`.
2. **`parseStatementDate` precisará suportar `DD-MM-YYYY` (traços)** além de `/`.
3. Possível formato de data textual pt-BR (`01 MAI 2026`) só será necessário se formos
   parsear PDF — adiar.

## Regras de categorização derivadas dos comerciantes reais

Uber → Transporte · Petroradio/Petroleo/Posto → Transporte (combustível) · Parking/Estacionamento
→ Transporte · Sushi/Pastelaria/Pizzaria/Restaurante/Mercado(grocery)/Conveniência/Padaria →
Alimentação · Farmácia/Drogaria → Saúde · Claro/Vivo/Tim/Energia → Contas · Materiais de
construção → Moradia · Rendimentos/Resgate/Salário → Renda.
(Implementadas no Plano 4 — `@lastro/categorizer`.)
