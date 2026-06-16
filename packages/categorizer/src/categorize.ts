import type { CategorizeResult, CategoryRule } from './types';
import { normalizeText } from './normalize';

function matches(rule: CategoryRule, normalized: string): boolean {
  const pattern = rule.matchType === 'regex' ? rule.pattern : normalizeText(rule.pattern);
  switch (rule.matchType) {
    case 'contains':
      return normalized.includes(pattern);
    case 'equals':
      return normalized === pattern;
    case 'regex':
      return new RegExp(pattern, 'i').test(normalized);
  }
}

/**
 * Sugere a categoria de uma descrição aplicando as regras.
 * Regras de maior peso vencem; empate → padrão mais longo (mais específico).
 */
export function categorize(description: string, rules: CategoryRule[]): CategorizeResult {
  const normalized = normalizeText(description);
  const ordered = [...rules].sort(
    (a, b) => b.weight - a.weight || b.pattern.length - a.pattern.length,
  );
  for (const rule of ordered) {
    if (matches(rule, normalized)) {
      return { category: rule.category, rule };
    }
  }
  return { category: null, rule: null };
}
