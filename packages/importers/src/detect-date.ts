import type { DateFormat } from './types';

/** Infere o formato de data a partir de amostras. null se inconclusivo. */
export function detectDateFormat(samples: string[]): DateFormat | null {
  const clean = samples.map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) return null;
  const matchesAll = (re: RegExp) => clean.every((s) => re.test(s));
  if (matchesAll(/^\d{4}-\d{2}-\d{2}$/)) return 'yyyy-mm-dd';
  if (matchesAll(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) return 'dd/mm/yyyy';
  if (matchesAll(/^\d{1,2}-\d{1,2}-\d{4}$/)) return 'dd-mm-yyyy';
  return null;
}
