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

revoke all on function public.is_system_admin(uuid) from public;
grant execute on function public.is_system_admin(uuid) to authenticated;

create or replace function public.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_system_admin(auth.uid());
$$;

revoke all on function public.is_system_admin() from public;
grant execute on function public.is_system_admin() to authenticated;

drop policy if exists "System admins can view all pools" on public.pools;
create policy "System admins can view all pools"
on public.pools for select
to authenticated
using (public.is_system_admin());

drop policy if exists "System admins can view all pool members" on public.pool_members;
create policy "System admins can view all pool members"
on public.pool_members for select
to authenticated
using (public.is_system_admin());

drop policy if exists "System admins can update pools" on public.pools;
create policy "System admins can update pools"
on public.pools for update
to authenticated
using (public.is_system_admin())
with check (public.is_system_admin());

drop policy if exists "System admins can view live score sync logs" on public.live_score_sync_logs;
create policy "System admins can view live score sync logs"
on public.live_score_sync_logs for select
to authenticated
using (public.is_system_admin());

drop policy if exists "Pool owners can view live score sync logs" on public.live_score_sync_logs;

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
    ) as row_number
  from public.predictions p
),
duplicates as (
  select *
  from ranked_predictions
  where row_number > 1
)
insert into public.prediction_duplicate_audit (archived_prediction)
select to_jsonb(duplicates) - 'row_number'
from duplicates
on conflict do nothing;

with ranked_predictions as (
  select
    p.id,
    row_number() over (
      partition by p.user_id, p.match_id
      order by p.updated_at desc, p.created_at desc, p.id desc
    ) as row_number
  from public.predictions p
)
delete from public.predictions p
using ranked_predictions rp
where p.id = rp.id
  and rp.row_number > 1;

create unique index if not exists predictions_user_match_unique_idx
on public.predictions(user_id, match_id);

revoke all on function public.save_prediction(uuid, uuid, integer, integer) from public;
revoke all on function public.save_prediction(uuid, uuid, integer, integer) from authenticated;
drop function if exists public.save_prediction(uuid, uuid, integer, integer);

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
  if not (public.is_system_admin() or public.is_pool_owner(target_pool_id)) then
    raise exception 'Only admins or pool owners can view participant details';
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

  if not (public.is_system_admin() or public.is_pool_owner(target_pool_id)) then
    raise exception 'Only admins or pool owners can update branding';
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
