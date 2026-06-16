-- Regras de categorização aprendidas ("contém 'iFood'" -> Alimentação).
create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  match_type text not null default 'contains'  -- contains | equals | regex
    check (match_type in ('contains', 'equals', 'regex')),
  pattern text not null,
  category_id uuid not null references public.categories (id) on delete cascade,
  weight integer not null default 1,
  created_at timestamptz not null default now()
);

create index category_rules_user_id_idx on public.category_rules (user_id);
