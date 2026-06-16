import { describe, it, expect } from 'vitest';
import { normalizeText } from './normalize';

describe('normalizeText', () => {
  it('minúsculas, sem acento, espaços colapsados', () => {
    expect(normalizeText('  Farmácia   da   SAÚDE ')).toBe('farmacia da saude');
  });
  it('remove diacríticos diversos', () => {
    expect(normalizeText('Educação')).toBe('educacao');
  });
});
