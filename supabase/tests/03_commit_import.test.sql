begin;
select plan(5);

-- Usuário + conta de teste.
insert into auth.users (id, email)
  values ('00000000-0000-0000-0000-0000000000c1', 'commit@test.com');
insert into public.accounts (id, user_id, name)
  values ('00000000-0000-0000-0000-0000000000c2',
          '00000000-0000-0000-0000-0000000000c1', 'Conta Commit');

-- Vira o usuário (authenticated + JWT) para a RPC enxergar auth.uid().
set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

-- Chamada com 2 itens distintos: insere 2, 0 duplicados.
select is(
  (select public.commit_import(
    '00000000-0000-0000-0000-0000000000c2', 'csv', 'extrato.csv',
    '[{"amount_cents":-1500,"description":"Uber","occurred_at":"2026-05-01","dedup_hash":"h1","category_id":null},
      {"amount_cents":-3000,"description":"Sushi","occurred_at":"2026-05-02","dedup_hash":"h2","category_id":null}]'::jsonb
  ) ->> 'inserted')::int,
  2, 'insere 2 transações novas'
);

-- Reimportar os mesmos hashes: 0 inseridos, 2 duplicados (dedup do banco).
select is(
  (select public.commit_import(
    '00000000-0000-0000-0000-0000000000c2', 'csv', 'extrato.csv',
    '[{"amount_cents":-1500,"description":"Uber","occurred_at":"2026-05-01","dedup_hash":"h1","category_id":null},
      {"amount_cents":-3000,"description":"Sushi","occurred_at":"2026-05-02","dedup_hash":"h2","category_id":null}]'::jsonb
  ) ->> 'duplicates')::int,
  2, 'reimportação detecta 2 duplicados'
);

-- Total de transações do usuário = 2 (duplicados não entram).
select is(
  (select count(*)::int from public.transactions
   where user_id = '00000000-0000-0000-0000-0000000000c1'),
  2, 'duplicados não são gravados'
);

-- Atomicidade: item inválido (amount_cents nulo viola NOT NULL) → rollback total.
select throws_ok(
  $$ select public.commit_import(
       '00000000-0000-0000-0000-0000000000c2', 'csv', 'ruim.csv',
       '[{"amount_cents":null,"description":"X","occurred_at":"2026-05-03","dedup_hash":"h3","category_id":null}]'::jsonb
     ) $$
);

-- Atomicidade: o import da chamada que falhou NÃO foi gravado (rollback total).
select is(
  (select count(*)::int from public.imports
   where user_id = '00000000-0000-0000-0000-0000000000c1'),
  2, 'chamada que falhou não deixa import órfão (2 imports das 2 chamadas bem-sucedidas)'
);

select * from finish();
rollback;
