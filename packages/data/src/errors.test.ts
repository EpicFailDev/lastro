import { describe, expect, it } from 'vitest';
import { PostgrestError } from '@supabase/supabase-js';
import { DataError, unwrap } from './errors';

describe('unwrap', () => {
  it('devolve data quando não há erro', () => {
    expect(unwrap({ data: [1, 2], error: null })).toEqual([1, 2]);
  });

  it('lança DataError quando há erro', () => {
    const error = new PostgrestError({ message: 'boom', code: '42501', details: 'x', hint: '' });
    expect(() => unwrap({ data: null, error })).toThrow(DataError);
    try {
      unwrap({ data: null, error });
    } catch (e) {
      expect((e as DataError).message).toBe('boom');
      expect((e as DataError).cause).toBe(error);
    }
  });
});
