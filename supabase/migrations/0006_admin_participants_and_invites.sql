create or replace function public.get_pool_participants(target_pool_id uuid)
returns table (
  user_id uuid,
  role text,
  created_at timestamptz,
  name text,
  avatar_url text,
  email text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_pool_owner(target_pool_id) then
    raise exception 'Only pool owners can view participant details';
  end if;

  return query
  select
    pm.user_id,
    pm.role,
    pm.created_at,
    p.name,
    p.avatar_url,
    au.email::text
  from public.pool_members pm
  left join public.profiles p on p.id = pm.user_id
  left join auth.users au on au.id = pm.user_id
  where pm.pool_id = target_pool_id
  order by pm.created_at asc;
end;
$$;

revoke all on function public.get_pool_participants(uuid) from public;
grant execute on function public.get_pool_participants(uuid) to authenticated;
