create or replace function public.update_pool_branding(
  target_pool_id uuid,
  target_header_title text default null,
  target_logo_url text default null
)
returns table (
  header_title text,
  logo_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_owner(target_pool_id) then
    raise exception 'Only pool owners can update branding';
  end if;

  return query
  update public.pools as target_pool
  set
    header_title = nullif(trim(target_header_title), ''),
    logo_url = nullif(trim(target_logo_url), ''),
    updated_at = now()
  where target_pool.id = target_pool_id
  returning
    target_pool.header_title,
    target_pool.logo_url;
end;
$$;

revoke all on function public.update_pool_branding(uuid, text, text) from public;
grant execute on function public.update_pool_branding(uuid, text, text) to authenticated;
