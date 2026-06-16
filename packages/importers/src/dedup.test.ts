import { describe, it, expect } from 'vitest';
import { makeDedupHash } from './dedup';

describe('makeDedupHash', () => {
  const base = { occurredAt: '2026-02-05', amountCents: -1500, description: 'iFood' };

  it('é determinístico', () => {
    expect(makeDedupHash(base)).toBe(makeDedupHash(base));
  });
  it('ignora caixa/espaços na descrição', () => {
    expect(makeDedupHash(base)).toBe(makeDedupHash({ ...base, description: '  IFOOD  ' }));
  });
  it('muda se o valor muda', () => {
    expect(makeDedupHash(base)).not.toBe(makeDedupHash({ ...base, amountCents: -1600 }));
  });
  it('muda se a data muda', () => {
    expect(makeDedupHash(base)).not.toBe(makeDedupHash({ ...base, occurredAt: '2026-02-06' }));
  });
});
