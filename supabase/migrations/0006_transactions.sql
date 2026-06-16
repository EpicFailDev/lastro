-- Transações: o coração do app. amount_cents negativo = despesa, positivo = receita.
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  amount_cents integer not null,
  currency text not null default 'BRL',
  description text,
  occurred_at timestamptz not null,
  import_id uuid references public.imports (id) on delete set null,
  dedup_hash text not null,
  is_manual boolean not null default false,
  created_at timestamptz not null default now(),
  -- Impede importar a mesma transação duas vezes para o mesmo usuário.
  constraint transactions_user_dedup_unique unique (user_id, dedup_hash)
);

create index transactions_user_id_idx on public.transactions (user_id);
create index transactions_account_id_idx on public.transactions (account_id);
create index transactions_occurred_at_idx on public.transactions (occurred_at);
