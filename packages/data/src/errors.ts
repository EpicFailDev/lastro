import type { PostgrestError } from '@supabase/supabase-js';

/** Erro tipado de qualquer operação Supabase/PostgREST. */
export class DataError extends Error {
  constructor(public override readonly cause: PostgrestError) {
    super(cause.message);
    this.name = 'DataError';
  }
}

/** Desembrulha a resposta `{ data, error }` do supabase-js; lança em caso de erro. */
export function unwrap<T>(res: { data: T | null; error: PostgrestError | null }): T {
  if (res.error) throw new DataError(res.error);
  return res.data as T;
}
