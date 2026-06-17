import { describe, expect, it } from 'vitest';
import { dataKeys } from './keys';

describe('dataKeys', () => {
  it('chaves estáticas estáveis', () => {
    expect(dataKeys.accounts()).toEqual(['accounts']);
    expect(dataKeys.categories()).toEqual(['categories']);
    expect(dataKeys.rules()).toEqual(['rules']);
  });

  it('transactions sem filtro vs com filtro', () => {
    expect(dataKeys.transactions()).toEqual(['transactions']);
    expect(dataKeys.transactions({ accountId: 'a1' })).toEqual([
      'transactions',
      { accountId: 'a1' },
    ]);
  });
});
