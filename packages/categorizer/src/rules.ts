import type { CategoryRule } from './types';

function r(pattern: string, category: string): CategoryRule {
  return { matchType: 'contains', pattern, category, weight: 1 };
}

/** Regras-semente. Patterns em forma normalizada (minúsculas, sem acento). */
export const defaultRules: CategoryRule[] = [
  // Transporte
  r('uber', 'Transporte'),
  r('cabify', 'Transporte'),
  r('99 tecnologia', 'Transporte'),
  r('posto', 'Transporte'),
  r('petroleo', 'Transporte'),
  r('petroradio', 'Transporte'),
  r('ipiranga', 'Transporte'),
  r('combustivel', 'Transporte'),
  r('estacionamento', 'Transporte'),
  r('parking', 'Transporte'),
  // Alimentação
  r('ifood', 'Alimentação'),
  r('rappi', 'Alimentação'),
  r('restaurante', 'Alimentação'),
  r('sushi', 'Alimentação'),
  r('pizza', 'Alimentação'),
  r('pastel', 'Alimentação'),
  r('padaria', 'Alimentação'),
  r('lanche', 'Alimentação'),
  r('hamburg', 'Alimentação'),
  r('acai', 'Alimentação'),
  r('supermercado', 'Alimentação'),
  r('mercado mister', 'Alimentação'),
  r('mercadinho', 'Alimentação'),
  r('hortifruti', 'Alimentação'),
  r('atacad', 'Alimentação'),
  r('conveniencia', 'Alimentação'),
  r('sendas', 'Alimentação'),
  // Saúde
  r('farmacia', 'Saúde'),
  r('drogaria', 'Saúde'),
  r('drogasil', 'Saúde'),
  r('hospital', 'Saúde'),
  r('clinica', 'Saúde'),
  r('laboratorio', 'Saúde'),
  // Contas
  r('claro', 'Contas'),
  r('vivo', 'Contas'),
  r('energia', 'Contas'),
  r('enel', 'Contas'),
  r('sabesp', 'Contas'),
  r('telefon', 'Contas'),
  // Moradia
  r('aluguel', 'Moradia'),
  r('condominio', 'Moradia'),
  r('imobiliaria', 'Moradia'),
  r('materiais de construcao', 'Moradia'),
  r('construcao', 'Moradia'),
  // Educação
  r('escola', 'Educação'),
  r('faculdade', 'Educação'),
  r('universidade', 'Educação'),
  r('curso', 'Educação'),
  // Compras
  r('amazon', 'Compras'),
  r('mercado livre', 'Compras'),
  r('shopee', 'Compras'),
  r('aliexpress', 'Compras'),
  r('magazine', 'Compras'),
  r('renner', 'Compras'),
  // Lazer
  r('netflix', 'Lazer'),
  r('spotify', 'Lazer'),
  r('cinema', 'Lazer'),
  r('steam', 'Lazer'),
  r('disney', 'Lazer'),
  // Renda
  r('rendimentos', 'Renda'),
  r('rendimento', 'Renda'),
  r('resgate', 'Renda'),
  r('salario', 'Renda'),
  r('pro labore', 'Renda'),
];
