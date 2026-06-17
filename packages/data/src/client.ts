import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type DataClient = SupabaseClient<Database>;

/** Cria um cliente Supabase tipado pelo schema do Lastro. */
export function createDataClient(url: string, anonKey: string): DataClient {
  return createClient<Database>(url, anonKey);
}
