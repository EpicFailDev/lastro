import { semantic, type SemanticTokens } from './semantic';

export type ThemeName = 'light' | 'dark';

export const themes = semantic;

export const tokenKeys = Object.keys(semantic.light) as (keyof SemanticTokens)[];
