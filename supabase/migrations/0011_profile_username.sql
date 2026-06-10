alter table public.profiles
add column if not exists username text;

create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;

create unique index if not exists profiles_username_unique
on public.profiles (lower(username))
where username is not null;

create or replace function public.slugify_username(input_value text)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              lower(extensions.unaccent(trim(coalesce(input_value, '')))),
              '[^a-z0-9\s-]',
              '',
              'g'
            ),
            '\s+',
            '-',
            'g'
          ),
          '-+',
          '-',
          'g'
        ),
        '(^-+|-+$)',
        '',
        'g'
      ),
      ''
    ),
    'visitante'
  );
$$;

create or replace function public.next_available_username(base_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_base text := public.slugify_username(base_username);
  candidate text := normalized_base;
  candidate_number int := 2;
begin
  loop
    exit when not exists (
      select 1
      from public.profiles p
      where lower(p.username) = lower(candidate)
    );

    candidate := normalized_base || '-' || candidate_number;
    candidate_number := candidate_number + 1;
  end loop;

  return candidate;
end;
$$;

revoke all on function public.next_available_username(text) from public;

drop function if exists public.ensure_user_profile_for_pool(uuid, text);

create or replace function public.ensure_user_profile_for_pool(
  target_pool_id uuid,
  preferred_name text default null
)
returns table (
  id uuid,
  name text,
  username text,
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
  resolved_username text;
  candidate_name text;
  candidate_number int := 1;
  returned_id uuid;
  returned_name text;
  returned_username text;
  returned_avatar_url text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can ensure profile';
  end if;

  perform pg_advisory_xact_lock(hashtext('profile-username'));

  select *
  into existing_profile
  from public.profiles p
  where p.id = current_user_id;

  if existing_profile.id is not null
    and nullif(trim(existing_profile.name), '') is not null
    and nullif(trim(existing_profile.username), '') is not null
  then
    return query
    select
      existing_profile.id,
      existing_profile.name,
      existing_profile.username,
      existing_profile.avatar_url;
    return;
  end if;

  if resolved_name is null then
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

  if existing_profile.id is not null
    and nullif(trim(existing_profile.name), '') is not null
  then
    resolved_name := existing_profile.name;
  end if;

  if existing_profile.id is not null
    and nullif(trim(existing_profile.username), '') is not null
  then
    resolved_username := existing_profile.username;
  else
    resolved_username := public.next_available_username(resolved_name);
  end if;

  insert into public.profiles as target_profile (id, name, username, avatar_url)
  values (current_user_id, resolved_name, resolved_username, null)
  on conflict on constraint profiles_pkey do update
  set
    name = case
      when nullif(trim(target_profile.name), '') is null
        then excluded.name
      else target_profile.name
    end,
    username = case
      when nullif(trim(target_profile.username), '') is null
        then excluded.username
      else target_profile.username
    end,
    updated_at = now()
  returning
    target_profile.id,
    target_profile.name,
    target_profile.username,
    target_profile.avatar_url
  into
    returned_id,
    returned_name,
    returned_username,
    returned_avatar_url;

  return query
  select
    returned_id,
    returned_name,
    returned_username,
    returned_avatar_url;
end;
$$;

drop function if exists public.get_pool_leaderboard_data(uuid);

create function public.get_pool_leaderboard_data(target_pool_id uuid)
returns table (
  user_id uuid,
  profile_name text,
  username text,
  avatar_url text,
  match_id uuid,
  round_number int,
  predicted_home_score int,
  predicted_away_score int,
  actual_home_score int,
  actual_away_score int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can view leaderboard data';
  end if;

  return query
  select
    pm.user_id,
    p.name as profile_name,
    p.username,
    p.avatar_url,
    m.id as match_id,
    m.round_number,
    pr.home_score as predicted_home_score,
    pr.away_score as predicted_away_score,
    m.home_score as actual_home_score,
    m.away_score as actual_away_score
  from public.pool_members pm
  cross join public.matches m
  left join public.profiles p on p.id = pm.user_id
  left join public.predictions pr
    on pr.pool_id = pm.pool_id
    and pr.user_id = pm.user_id
    and pr.match_id = m.id
  where pm.pool_id = target_pool_id
  order by
    lower(coalesce(p.name, '')),
    pm.user_id,
    m.round_number,
    m.created_at;
end;
$$;

revoke all on function public.ensure_user_profile_for_pool(uuid, text) from public;
grant execute on function public.ensure_user_profile_for_pool(uuid, text) to authenticated;

revoke all on function public.get_pool_leaderboard_data(uuid) from public;
grant execute on function public.get_pool_leaderboard_data(uuid) to authenticated;
