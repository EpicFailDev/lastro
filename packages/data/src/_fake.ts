import type { DataClient } from './client';

export type FakeRpcCall = { fn: string; args: Record<string, unknown> };

/** Fake mínimo de DataClient para testar orquestração sem banco. */
export function makeFakeClient(opts: {
  tables?: Record<string, unknown[]>;
  rpcResult?: unknown;
}): { client: DataClient; rpcCalls: FakeRpcCall[] } {
  const rpcCalls: FakeRpcCall[] = [];
  const client = {
    from(table: string) {
      return {
        select: () => Promise.resolve({ data: opts.tables?.[table] ?? [], error: null }),
      };
    },
    rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: opts.rpcResult ?? null, error: null });
    },
  } as unknown as DataClient;
  return { client, rpcCalls };
}
