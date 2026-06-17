-- Importa um lote de transações atomicamente: cria a linha de auditoria em `imports`
-- e insere as transações (ignorando duplicadas por (user_id, dedup_hash)).
-- security invoker: roda como o usuário chamador, respeitando RLS e auth.uid().
create or replace function public.commit_import(
  p_account_id uuid,
  p_format text,
  p_file_name text,
  p_items jsonb
) returns jsonb
language plpgsql
security invoker
as $$
declare
  v_user_id uuid := auth.uid();
  v_import_id uuid;
  v_total int := jsonb_array_length(p_items);
  v_inserted int;
begin
  if v_user_id is null then
    raise exception 'commit_import: usuário não autenticado';
  end if;

  insert into public.imports (user_id, account_id, source_format, file_name, row_count)
  values (v_user_id, p_account_id, p_format, p_file_name, v_total)
  returning id into v_import_id;

  with ins as (
    insert into public.transactions
      (user_id, account_id, category_id, amount_cents, description, occurred_at, dedup_hash, import_id)
    select
      v_user_id,
      p_account_id,
      nullif(item->>'category_id', '')::uuid,
      (item->>'amount_cents')::int,
      item->>'description',
      (item->>'occurred_at')::timestamptz,
      item->>'dedup_hash',
      v_import_id
    from jsonb_array_elements(p_items) as item
    on conflict (user_id, dedup_hash) do nothing
    returning 1
  )
  select count(*)::int into v_inserted from ins;

  return jsonb_build_object(
    'import_id', v_import_id,
    'inserted', v_inserted,
    'duplicates', v_total - v_inserted
  );
end;
$$;

grant execute on function public.commit_import(uuid, text, text, jsonb) to authenticated;
