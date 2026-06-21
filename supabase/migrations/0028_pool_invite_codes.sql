alter table public.pools
add column if not exists invite_code text;

create unique index if not exists pools_invite_code_unique_idx
on public.pools (invite_code)
where invite_code is not null;

create or replace function public.generate_pool_invite_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));

    exit when not exists (
      select 1
      from public.pools p
      where p.invite_code = candidate
    );
  end loop;

  return candidate;
end;
$$;

update public.pools
set invite_code = public.generate_pool_invite_code()
where type = 'private'
  and invite_code is null;

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
    owner_id,
    invite_code
  )
  values (
    resolved_name,
    resolved_description,
    'private',
    false,
    current_user_id,
    public.generate_pool_invite_code()
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

create or replace function public.get_pool_invite_by_code(target_invite_code text)
returns table (
  pool_id uuid,
  pool_name text,
  pool_description text,
  invite_code text,
  is_valid boolean,
  is_member boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  pool_record public.pools%rowtype;
begin
  select *
  into pool_record
  from public.pools p
  where upper(p.invite_code) = upper(nullif(trim(target_invite_code), ''))
    and p.type = 'private'
    and p.is_default is not true;

  if pool_record.id is null then
    return query
    select
      null::uuid,
      null::text,
      null::text,
      null::text,
      false,
      false;
    return;
  end if;

  return query
  select
    pool_record.id,
    pool_record.name,
    pool_record.description,
    pool_record.invite_code,
    true,
    case
      when current_user_id is null then false
      else exists (
        select 1
        from public.pool_members pm
        where pm.pool_id = pool_record.id
          and pm.user_id = current_user_id
      )
    end;
end;
$$;

revoke all on function public.get_pool_invite_by_code(text) from public;
grant execute on function public.get_pool_invite_by_code(text) to anon, authenticated;

create or replace function public.join_pool_by_invite_code(target_invite_code text)
returns table (
  pool_id uuid,
  pool_name text,
  already_member boolean,
  joined boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  pool_record public.pools%rowtype;
  was_member boolean;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into pool_record
  from public.pools p
  where upper(p.invite_code) = upper(nullif(trim(target_invite_code), ''))
    and p.type = 'private'
    and p.is_default is not true;

  if pool_record.id is null then
    raise exception 'Invalid invite';
  end if;

  select exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = pool_record.id
      and pm.user_id = current_user_id
  )
  into was_member;

  insert into public.pool_members (
    pool_id,
    user_id,
    role
  )
  values (
    pool_record.id,
    current_user_id,
    'member'
  )
  on conflict (pool_id, user_id) do nothing;

  return query
  select
    pool_record.id,
    pool_record.name,
    was_member,
    not was_member;
end;
$$;

revoke all on function public.join_pool_by_invite_code(text) from public;
grant execute on function public.join_pool_by_invite_code(text) to authenticated;
