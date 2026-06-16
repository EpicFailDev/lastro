import type { CsvTemplate, ImportResult } from './types';
import { parseCsv } from './csv';
import { parseOfx } from './ofx';

function looksLikeOfx(content: string): boolean {
  const head = content.slice(0, 512).toUpperCase();
  return head.includes('OFXHEADER') || head.includes('<OFX>');
}

/** Detecta o formato e delega ao parser apropriado. */
export function detectAndParse(content: string, opts: { csvTemplate?: CsvTemplate }): ImportResult {
  if (looksLikeOfx(content)) {
    return parseOfx(content);
  }
  if (!opts.csvTemplate) {
    throw new Error('Conteúdo CSV exige um template (csvTemplate) para ser interpretado.');
  }
  return parseCsv(content, opts.csvTemplate);
}
