begin;
select plan(17);

-- Tabelas existem.
select has_table('public', 'profiles', 'profiles existe');
select has_table('public', 'accounts', 'accounts existe');
select has_table('public', 'categories', 'categories existe');
select has_table('public', 'imports', 'imports existe');
select has_table('public', 'transactions', 'transactions existe');
select has_table('public', 'category_rules', 'category_rules existe');

-- RLS habilitado em cada tabela.
select is((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  true, 'RLS habilitado em profiles');
select is((select relrowsecurity from pg_class where oid = 'public.accounts'::regclass),
  true, 'RLS habilitado em accounts');
select is((select relrowsecurity from pg_class where oid = 'public.categories'::regclass),
  true, 'RLS habilitado em categories');
select is((select relrowsecurity from pg_class where oid = 'public.imports'::regclass),
  true, 'RLS habilitado em imports');
select is((select relrowsecurity from pg_class where oid = 'public.transactions'::regclass),
  true, 'RLS habilitado em transactions');
select is((select relrowsecurity from pg_class where oid = 'public.category_rules'::regclass),
  true, 'RLS habilitado em category_rules');

-- Seed do sistema.
select is(
  (select count(*)::int from public.categories where user_id is null),
  10, 'existem 10 categorias do sistema'
);

-- Colunas críticas com o tipo certo.
select col_type_is('public', 'transactions', 'amount_cents', 'integer',
  'amount_cents é integer (centavos)');
select col_type_is('public', 'transactions', 'occurred_at', 'timestamp with time zone',
  'occurred_at é timestamptz (UTC)');
select col_type_is('public', 'transactions', 'id', 'uuid', 'id é uuid');
select col_type_is('public', 'accounts', 'id', 'uuid', 'accounts.id é uuid');

select * from finish();
rollback;
