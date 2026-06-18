import { color } from './primitives';

export type SemanticTokens = {
  'bg.canvas': string;
  'bg.surface': string;
  'bg.subtle': string;
  border: string;
  'text.primary': string;
  'text.muted': string;
  'text.onAccent': string;
  brand: string;
  accent: string;
  'accent.hover': string;
  'amount.positive': string;
  'amount.negative': string;
  focusRing: string;
};

const light: SemanticTokens = {
  'bg.canvas': color.neutral['50'],
  'bg.surface': color.neutral['0'],
  'bg.subtle': color.neutral['100'],
  border: color.neutral['200'],
  'text.primary': color.neutral['900'],
  'text.muted': color.neutral['600'],
  'text.onAccent': color.neutral['900'],
  brand: color.teal['500'],
  accent: color.coral['500'],
  'accent.hover': color.coral['600'],
  'amount.positive': color.feedback.success,
  'amount.negative': color.feedback.danger,
  focusRing: color.coral['500'],
};

const dark: SemanticTokens = {
  'bg.canvas': color.neutral['900'],
  'bg.surface': '#1C2424',
  'bg.subtle': color.neutral['800'],
  border: color.neutral['700'],
  'text.primary': color.neutral['50'],
  'text.muted': color.neutral['400'],
  'text.onAccent': color.neutral['900'],
  brand: color.teal['300'],
  accent: color.coral['400'],
  'accent.hover': color.coral['500'],
  'amount.positive': color.feedback.successLight,
  'amount.negative': color.feedback.dangerLight,
  focusRing: color.coral['400'],
};

export const semantic: { light: SemanticTokens; dark: SemanticTokens } = { light, dark };
