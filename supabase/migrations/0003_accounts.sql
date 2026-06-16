-- Contas/carteiras do usuário (Nubank, Mercado Pago, dinheiro...).
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null default 'wallet',        -- wallet | checking | credit_card
  institution text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index accounts_user_id_idx on public.accounts (user_id);
