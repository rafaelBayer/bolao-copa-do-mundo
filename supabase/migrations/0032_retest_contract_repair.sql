create extension if not exists pgcrypto;

alter table public.pools
add column if not exists description text;

alter table public.pools
add column if not exists type text not null default 'private';

alter table public.pools
add column if not exists is_default boolean not null default false;

alter table public.pools
add column if not exists invite_code text;

alter table public.pools
alter column owner_id drop not null;

do $$
begin
  alter table public.pools
  add constraint pools_type_check check (type in ('general', 'private'));
exception
  when duplicate_object then null;
end;
$$;

create unique index if not exists pools_single_default_idx
on public.pools (is_default)
where is_default;

create unique index if not exists pools_invite_code_unique_idx
on public.pools (invite_code)
where invite_code is not null;

create table if not exists public.system_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.system_admins enable row level security;

create or replace function public.is_system_admin(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_user_id is not null
    and exists (
      select 1
      from public.system_admins sa
      where sa.user_id = target_user_id
    );
$$;

create or replace function public.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_system_admin(auth.uid());
$$;

revoke all on function public.is_system_admin(uuid) from public;
revoke all on function public.is_system_admin() from public;
grant execute on function public.is_system_admin(uuid) to authenticated;
grant execute on function public.is_system_admin() to authenticated;

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

create table if not exists public.prediction_duplicate_audit (
  id uuid primary key default gen_random_uuid(),
  archived_prediction jsonb not null,
  archived_at timestamptz not null default now(),
  reason text not null default 'duplicate_user_match_before_unique_constraint'
);

with ranked_predictions as (
  select
    p.*,
    row_number() over (
      partition by p.user_id, p.match_id
      order by p.updated_at desc, p.created_at desc, p.id desc
    ) as duplicate_rank
  from public.predictions p
),
duplicates as (
  select *
  from ranked_predictions
  where duplicate_rank > 1
)
insert into public.prediction_duplicate_audit (archived_prediction)
select to_jsonb(duplicates) - 'duplicate_rank'
from duplicates
on conflict do nothing;

with ranked_predictions as (
  select
    p.id,
    row_number() over (
      partition by p.user_id, p.match_id
      order by p.updated_at desc, p.created_at desc, p.id desc
    ) as duplicate_rank
  from public.predictions p
)
delete from public.predictions p
using ranked_predictions rp
where p.id = rp.id
  and rp.duplicate_rank > 1;

create unique index if not exists predictions_user_match_unique_idx
on public.predictions(user_id, match_id);

drop function if exists public.save_prediction(uuid, uuid, integer, integer);

create or replace function public.save_prediction(
  target_match_id uuid,
  predicted_home_score integer,
  predicted_away_score integer
)
returns table (
  id uuid,
  pool_id uuid,
  user_id uuid,
  match_id uuid,
  home_score integer,
  away_score integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  default_pool_id uuid;
  match_kickoff_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  default_pool_id := public.ensure_default_pool_membership(null);

  select m.kickoff_at
  into match_kickoff_at
  from public.matches m
  where m.id = target_match_id;

  if not found then
    raise exception 'Match not found';
  end if;

  if match_kickoff_at is not null and now() >= match_kickoff_at - interval '1 hour' then
    raise exception 'Prediction locked because match starts within one hour';
  end if;

  return query
  insert into public.predictions as target_prediction (
    pool_id,
    user_id,
    match_id,
    home_score,
    away_score,
    updated_at
  )
  values (
    default_pool_id,
    current_user_id,
    target_match_id,
    predicted_home_score,
    predicted_away_score,
    now()
  )
  on conflict (user_id, match_id)
  do update set
    home_score = excluded.home_score,
    away_score = excluded.away_score,
    updated_at = now()
  returning
    target_prediction.id,
    target_prediction.pool_id,
    target_prediction.user_id,
    target_prediction.match_id,
    target_prediction.home_score,
    target_prediction.away_score,
    target_prediction.created_at,
    target_prediction.updated_at;
end;
$$;

revoke all on function public.save_prediction(uuid, integer, integer) from public;
grant execute on function public.save_prediction(uuid, integer, integer) to authenticated;

create or replace function public.admin_update_match_live_score(
  target_pool_id uuid,
  target_match_id uuid,
  target_home_score_live integer,
  target_away_score_live integer,
  target_status_short text default '1H',
  target_elapsed integer default null
)
returns table (
  id uuid,
  home_score_live integer,
  away_score_live integer,
  status_short text,
  status_long text,
  elapsed integer,
  score_updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_status text := upper(nullif(trim(target_status_short), ''));
  resolved_status_long text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_system_admin() then
    raise exception 'Only system admins can update live scores';
  end if;

  if target_pool_id is null then
    raise exception 'Pool context is required';
  end if;

  if target_home_score_live is null or target_home_score_live < 0 then
    raise exception 'Invalid home live score';
  end if;

  if target_away_score_live is null or target_away_score_live < 0 then
    raise exception 'Invalid away live score';
  end if;

  if target_elapsed is not null and target_elapsed < 0 then
    raise exception 'Invalid elapsed minute';
  end if;

  normalized_status := coalesce(normalized_status, '1H');
  resolved_status_long := case normalized_status
    when '1H' then 'First Half'
    when '2H' then 'Second Half'
    when 'HT' then 'Halftime'
    when 'FT' then 'Match Finished'
    else normalized_status
  end;

  return query
  update public.matches as target_match
  set
    home_score_live = target_home_score_live,
    away_score_live = target_away_score_live,
    status_short = normalized_status,
    status_long = resolved_status_long,
    elapsed = target_elapsed,
    score_updated_at = now()
  where target_match.id = target_match_id
  returning
    target_match.id,
    target_match.home_score_live,
    target_match.away_score_live,
    target_match.status_short,
    target_match.status_long,
    target_match.elapsed,
    target_match.score_updated_at;
end;
$$;

create or replace function public.admin_finalize_match_score(
  target_pool_id uuid,
  target_match_id uuid,
  target_home_score integer,
  target_away_score integer
)
returns table (
  id uuid,
  home_score integer,
  away_score integer,
  status_short text,
  status_long text,
  score_updated_at timestamptz
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

  if not public.is_system_admin() then
    raise exception 'Only system admins can finalize scores';
  end if;

  if target_pool_id is null then
    raise exception 'Pool context is required';
  end if;

  if target_home_score is null or target_home_score < 0 then
    raise exception 'Invalid home score';
  end if;

  if target_away_score is null or target_away_score < 0 then
    raise exception 'Invalid away score';
  end if;

  return query
  update public.matches as target_match
  set
    home_score = target_home_score,
    away_score = target_away_score,
    home_score_live = target_home_score,
    away_score_live = target_away_score,
    status_short = 'FT',
    status_long = 'Match Finished',
    elapsed = 90,
    score_updated_at = now()
  where target_match.id = target_match_id
  returning
    target_match.id,
    target_match.home_score,
    target_match.away_score,
    target_match.status_short,
    target_match.status_long,
    target_match.score_updated_at;
end;
$$;

revoke all on function public.admin_update_match_live_score(uuid, uuid, integer, integer, text, integer) from public;
revoke all on function public.admin_finalize_match_score(uuid, uuid, integer, integer) from public;
grant execute on function public.admin_update_match_live_score(uuid, uuid, integer, integer, text, integer) to authenticated;
grant execute on function public.admin_finalize_match_score(uuid, uuid, integer, integer) to authenticated;

notify pgrst, 'reload schema';
