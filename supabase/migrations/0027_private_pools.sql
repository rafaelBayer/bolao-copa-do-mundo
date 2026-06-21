create or replace function public.create_private_pool(
  target_name text,
  target_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  resolved_name text := nullif(trim(target_name), '');
  resolved_description text := nullif(trim(target_description), '');
  created_pool_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if resolved_name is null then
    raise exception 'Pool name is required';
  end if;

  insert into public.pools (
    name,
    description,
    type,
    is_default,
    owner_id
  )
  values (
    resolved_name,
    resolved_description,
    'private',
    false,
    current_user_id
  )
  returning id into created_pool_id;

  insert into public.pool_members (
    pool_id,
    user_id,
    role
  )
  values (
    created_pool_id,
    current_user_id,
    'owner'
  )
  on conflict (pool_id, user_id) do update
  set role = 'owner';

  return created_pool_id;
end;
$$;

revoke all on function public.create_private_pool(text, text) from public;
grant execute on function public.create_private_pool(text, text) to authenticated;
