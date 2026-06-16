-- Histórico de cada arquivo de extrato importado (auditoria / desfazer).
create table public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  source_format text not null,                 -- ofx | csv
  file_name text,
  row_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index imports_user_id_idx on public.imports (user_id);
