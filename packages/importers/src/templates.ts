import type { CsvTemplate } from './types';

/**
 * Templates de CSV por banco. São o melhor palpite com base nos formatos comuns;
 * ajuste as colunas/flags/delimitador quando tiver um export real em mãos.
 *
 * Regra prática: arquivos com vírgula decimal (pt-BR) normalmente usam ';' como
 * separador de coluna; arquivos com ponto decimal usam ','.
 */

// Fatura do cartão Nubank: "date,title,amount" (YYYY-MM-DD), despesas positivas.
export const nubankCardTemplate: CsvTemplate = {
  name: 'Nubank — Cartão',
  delimiter: ',',
  dateColumn: 'date',
  amountColumn: 'amount',
  descriptionColumn: 'title',
  dateFormat: 'yyyy-mm-dd',
  decimalSeparator: '.',
  invertSign: true,
};

// Extrato da conta Nubank: "Data;Valor;Identificador;Descrição" (DD/MM/YYYY).
export const nubankAccountTemplate: CsvTemplate = {
  name: 'Nubank — Conta',
  delimiter: ';',
  dateColumn: 'Data',
  amountColumn: 'Valor',
  descriptionColumn: 'Descrição',
  dateFormat: 'dd/mm/yyyy',
  decimalSeparator: ',',
};

// Mercado Pago (relatório de atividade): ajuste fino conforme o export real.
export const mercadoPagoTemplate: CsvTemplate = {
  name: 'Mercado Pago',
  delimiter: ';',
  dateColumn: 'Data',
  amountColumn: 'Valor',
  descriptionColumn: 'Descrição',
  dateFormat: 'dd/mm/yyyy',
  decimalSeparator: ',',
};

export const bankTemplates = {
  nubankCard: nubankCardTemplate,
  nubankAccount: nubankAccountTemplate,
  mercadoPago: mercadoPagoTemplate,
} as const;

export type BankTemplateKey = keyof typeof bankTemplates;
