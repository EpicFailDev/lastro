-- A role `authenticated` precisa de privilégios de tabela; o RLS é quem filtra as linhas.
-- A role `anon` (não logado) não recebe acesso: o app exige login.
grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.accounts,
  public.categories,
  public.imports,
  public.transactions,
  public.category_rules
  to authenticated;
