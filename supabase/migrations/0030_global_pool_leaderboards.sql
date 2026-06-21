create or replace function public.get_pool_leaderboard_data(target_pool_id uuid)
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
  left join lateral (
    select latest_pr.*
    from public.predictions latest_pr
    where latest_pr.user_id = pm.user_id
      and latest_pr.match_id = m.id
    order by latest_pr.updated_at desc, latest_pr.created_at desc, latest_pr.id
    limit 1
  ) pr on true
  where pm.pool_id = target_pool_id
  order by
    lower(coalesce(p.name, '')),
    pm.user_id,
    m.round_number,
    m.created_at;
end;
$$;

revoke all on function public.get_pool_leaderboard_data(uuid) from public;
grant execute on function public.get_pool_leaderboard_data(uuid) to authenticated;

create or replace function public.get_pool_live_leaderboard_data(target_pool_id uuid)
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
  actual_away_score int,
  is_live_match boolean,
  live_matches_count int
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
    raise exception 'Only pool members can view live leaderboard data';
  end if;

  return query
  with scoped_matches as (
    select
      m.*,
      upper(coalesce(m.status_short, '')) in ('LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P') as is_live_or_halftime,
      upper(coalesce(m.status_short, '')) in ('FT', 'AET', 'PEN') as is_finished
    from public.matches m
  ),
  live_count as (
    select count(*)::int as value
    from scoped_matches sm
    where sm.is_live_or_halftime
  )
  select
    pm.user_id,
    p.name as profile_name,
    p.username,
    p.avatar_url,
    sm.id as match_id,
    sm.round_number,
    pr.home_score as predicted_home_score,
    pr.away_score as predicted_away_score,
    case
      when sm.is_finished then sm.home_score
      when sm.is_live_or_halftime
        and sm.home_score_live is not null
        and sm.away_score_live is not null
        then sm.home_score_live
      else null
    end as actual_home_score,
    case
      when sm.is_finished then sm.away_score
      when sm.is_live_or_halftime
        and sm.home_score_live is not null
        and sm.away_score_live is not null
        then sm.away_score_live
      else null
    end as actual_away_score,
    sm.is_live_or_halftime as is_live_match,
    lc.value as live_matches_count
  from public.pool_members pm
  cross join scoped_matches sm
  cross join live_count lc
  left join public.profiles p on p.id = pm.user_id
  left join lateral (
    select latest_pr.*
    from public.predictions latest_pr
    where latest_pr.user_id = pm.user_id
      and latest_pr.match_id = sm.id
    order by latest_pr.updated_at desc, latest_pr.created_at desc, latest_pr.id
    limit 1
  ) pr on true
  where pm.pool_id = target_pool_id
  order by
    lower(coalesce(p.name, '')),
    pm.user_id,
    sm.round_number,
    sm.created_at;
end;
$$;

revoke all on function public.get_pool_live_leaderboard_data(uuid) from public;
grant execute on function public.get_pool_live_leaderboard_data(uuid) to authenticated;
