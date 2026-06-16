-- Habilita RLS em tudo.
alter table public.profiles       enable row level security;
alter table public.accounts       enable row level security;
alter table public.categories     enable row level security;
alter table public.imports        enable row level security;
alter table public.transactions   enable row level security;
alter table public.category_rules enable row level security;

-- profiles: o usuário lê e atualiza apenas o próprio.
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

-- accounts: CRUD apenas dos próprios registros.
create policy "accounts_all_own" on public.accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- categories: lê as próprias E as do sistema (user_id null); modifica só as próprias.
create policy "categories_select_own_or_system" on public.categories
  for select using (user_id = auth.uid() or user_id is null);
create policy "categories_insert_own" on public.categories
  for insert with check (user_id = auth.uid());
create policy "categories_update_own" on public.categories
  for update using (user_id = auth.uid());
create policy "categories_delete_own" on public.categories
  for delete using (user_id = auth.uid());

-- imports: CRUD apenas dos próprios.
create policy "imports_all_own" on public.imports
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- transactions: CRUD apenas das próprias.
create policy "transactions_all_own" on public.transactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- category_rules: CRUD apenas das próprias.
create policy "category_rules_all_own" on public.category_rules
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
