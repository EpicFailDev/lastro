-- Categorias. user_id NULL = categoria padrão do sistema (visível a todos, somente leitura).
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  icon text,
  color text,
  kind text not null default 'expense'         -- expense | income | both
    check (kind in ('expense', 'income', 'both')),
  created_at timestamptz not null default now()
);

create index categories_user_id_idx on public.categories (user_id);
