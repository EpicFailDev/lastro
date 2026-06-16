begin;
select plan(2);

-- Dois usuários.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000aa', 'alice@test.com'),
  ('00000000-0000-0000-0000-0000000000bb', 'bob@test.com');

-- Conta + transação da Alice (inseridas como superuser do teste).
insert into public.accounts (id, user_id, name)
  values ('00000000-0000-0000-0000-0000000000a2',
          '00000000-0000-0000-0000-0000000000aa', 'Conta Alice');
insert into public.transactions
  (user_id, account_id, amount_cents, occurred_at, dedup_hash)
  values ('00000000-0000-0000-0000-0000000000aa',
          '00000000-0000-0000-0000-0000000000a2',
          -999, now(), 'alice-1');

-- Vira a Alice (role authenticated + JWT com sub = id da Alice): vê 1 transação.
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-0000000000aa","role":"authenticated"}';
select is(
  (select count(*)::int from public.transactions),
  1, 'Alice vê a própria transação'
);

-- Vira o Bob: NÃO vê nenhuma transação da Alice.
set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-0000000000bb","role":"authenticated"}';
select is(
  (select count(*)::int from public.transactions),
  0, 'Bob não vê transações da Alice (RLS isola)'
);

reset role;
select * from finish();
rollback;
