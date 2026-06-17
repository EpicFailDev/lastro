import type { DataClient } from './client';

export type FakeRpcCall = { fn: string; args: Record<string, unknown> };

/** Fake mínimo de DataClient para testar orquestração sem banco. */
export function makeFakeClient(opts: { tables?: Record<string, unknown[]>; rpcResult?: unknown }): {
  client: DataClient;
  rpcCalls: FakeRpcCall[];
  updateCalls: Array<{ table: string; values: Record<string, unknown>; eqId?: string }>;
} {
  const rpcCalls: FakeRpcCall[] = [];
  const updateCalls: Array<{ table: string; values: Record<string, unknown>; eqId?: string }> = [];
  const client = {
    from(table: string) {
      const data = opts.tables?.[table] ?? [];
      let pendingUpdate: Record<string, unknown> | null = null;
      const builder: Record<string, unknown> = {
        select: () => builder,
        order: () => builder,
        eq: (_col: string, val: string) => {
          if (pendingUpdate) updateCalls.push({ table, values: pendingUpdate, eqId: val });
          return builder;
        },
        gte: () => builder,
        lte: () => builder,
        update: (values: Record<string, unknown>) => {
          pendingUpdate = values;
          return builder;
        },
        insert: () => ({
          select: () => ({ single: () => Promise.resolve({ data: data[0] ?? null, error: null }) }),
        }),
        delete: () => builder,
        then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
          resolve({ data, error: null }),
      };
      return builder;
    },
    rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: opts.rpcResult ?? null, error: null });
    },
  } as unknown as DataClient;
  return { client, rpcCalls, updateCalls };
}
