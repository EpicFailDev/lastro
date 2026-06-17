import { semantic, type SemanticTokens } from './semantic';
import { tokenKeys } from './themes';

export function cssVarName(token: string): string {
  return `--${token.replace(/\./g, '-')}`;
}

export function themeCssVars(theme: SemanticTokens): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of tokenKeys) out[cssVarName(key)] = theme[key];
  return out;
}

function block(selector: string, vars: Record<string, string>): string {
  const lines = Object.entries(vars).map(([name, value]) => `  ${name}: ${value};`);
  return `${selector} {\n${lines.join('\n')}\n}`;
}

export function themeCss(): string {
  return [
    block(':root', themeCssVars(semantic.light)),
    block('.dark', themeCssVars(semantic.dark)),
  ].join('\n\n');
}
