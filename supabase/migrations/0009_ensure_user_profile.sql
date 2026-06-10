create or replace function public.ensure_user_profile_for_pool(
  target_pool_id uuid,
  preferred_name text default null
)
returns table (
  id uuid,
  name text,
  avatar_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_profile public.profiles%rowtype;
  resolved_name text := nullif(trim(preferred_name), '');
  candidate_name text;
  candidate_number int := 1;
  returned_id uuid;
  returned_name text;
  returned_avatar_url text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can ensure profile';
  end if;

  select *
  into existing_profile
  from public.profiles p
  where p.id = current_user_id;

  if existing_profile.id is not null
    and nullif(trim(existing_profile.name), '') is not null
  then
    return query
    select
      existing_profile.id,
      existing_profile.name,
      existing_profile.avatar_url;
    return;
  end if;

  if resolved_name is null then
    perform pg_advisory_xact_lock(hashtext(target_pool_id::text));

    loop
      candidate_name := 'Visitante ' || candidate_number;

      exit when not exists (
        select 1
        from public.pool_members pm
        join public.profiles p on p.id = pm.user_id
        where pm.pool_id = target_pool_id
          and lower(trim(p.name)) = lower(candidate_name)
      );

      candidate_number := candidate_number + 1;
    end loop;

    resolved_name := candidate_name;
  end if;

  insert into public.profiles as target_profile (id, name, avatar_url)
  values (current_user_id, resolved_name, null)
  on conflict on constraint profiles_pkey do update
  set
    name = case
      when nullif(trim(target_profile.name), '') is null
        then excluded.name
      else target_profile.name
    end,
    updated_at = now()
  returning
    target_profile.id,
    target_profile.name,
    target_profile.avatar_url
  into
    returned_id,
    returned_name,
    returned_avatar_url;

  return query
  select
    returned_id,
    returned_name,
    returned_avatar_url;
end;
$$;

revoke all on function public.ensure_user_profile_for_pool(uuid, text) from public;
grant execute on function public.ensure_user_profile_for_pool(uuid, text) to authenticated;
