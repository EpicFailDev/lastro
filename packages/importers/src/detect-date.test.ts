import { describe, it, expect } from 'vitest';
import { detectDateFormat } from './detect-date';

describe('detectDateFormat', () => {
  it('reconhece dd/mm/yyyy', () => {
    expect(detectDateFormat(['02/06/2026', '15/06/2026'])).toBe('dd/mm/yyyy');
  });
  it('reconhece yyyy-mm-dd', () => {
    expect(detectDateFormat(['2026-06-02'])).toBe('yyyy-mm-dd');
  });
  it('reconhece dd-mm-yyyy', () => {
    expect(detectDateFormat(['02-06-2026'])).toBe('dd-mm-yyyy');
  });
  it('retorna null se inconclusivo', () => {
    expect(detectDateFormat(['banana', ''])).toBeNull();
  });
});
