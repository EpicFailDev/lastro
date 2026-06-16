begin;
select plan(2);

-- Cria um usuário e uma conta de teste (contornando RLS como superuser do teste).
insert into auth.users (id, email)
  values ('00000000-0000-0000-0000-000000000001', 'dedup@test.com');
insert into public.accounts (id, user_id, name)
  values ('00000000-0000-0000-0000-0000000000a1',
          '00000000-0000-0000-0000-000000000001', 'Conta Teste');

-- Primeira inserção com um dedup_hash funciona.
select lives_ok(
  $$ insert into public.transactions
       (user_id, account_id, amount_cents, occurred_at, dedup_hash)
     values ('00000000-0000-0000-0000-000000000001',
             '00000000-0000-0000-0000-0000000000a1',
             -1500, now(), 'hash-abc') $$,
  'primeira transação com hash-abc é aceita'
);

-- Segunda inserção com o MESMO (user_id, dedup_hash) é rejeitada.
select throws_ok(
  $$ insert into public.transactions
       (user_id, account_id, amount_cents, occurred_at, dedup_hash)
     values ('00000000-0000-0000-0000-000000000001',
             '00000000-0000-0000-0000-0000000000a1',
             -1500, now(), 'hash-abc') $$,
  '23505',  -- unique_violation
  null,
  'transação duplicada (mesmo hash) é rejeitada'
);

select * from finish();
rollback;
