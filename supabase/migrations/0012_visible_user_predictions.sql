create or replace function public.get_visible_user_predictions_by_username(
  target_pool_id uuid,
  target_username text
)
returns table (
  target_user_id uuid,
  target_name text,
  target_username text,
  target_avatar_url text,
  is_current_user boolean,
  blocked_predictions_count int,
  prediction_id uuid,
  match_id uuid,
  group_id uuid,
  group_name text,
  round_number int,
  kickoff_at timestamptz,
  home_team_name text,
  home_team_code text,
  away_team_name text,
  away_team_code text,
  predicted_home_score int,
  predicted_away_score int,
  actual_home_score int,
  actual_away_score int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_profile public.profiles%rowtype;
  is_self boolean;
  blocked_count int := 0;
  visible_count int := 0;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can view public profiles';
  end if;

  select *
  into target_profile
  from public.profiles p
  where lower(p.username) = lower(public.slugify_username(target_username));

  if target_profile.id is null then
    raise exception 'Profile not found';
  end if;

  if not exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = target_pool_id
      and pm.user_id = target_profile.id
  ) then
    raise exception 'Profile not found in this pool';
  end if;

  is_self := target_profile.id = current_user_id;

  if not is_self then
    select count(*)::int
    into blocked_count
    from public.predictions pr
    join public.matches m on m.id = pr.match_id
    where pr.pool_id = target_pool_id
      and pr.user_id = target_profile.id
      and pr.home_score is not null
      and pr.away_score is not null
      and (m.kickoff_at is null or m.kickoff_at > now());
  end if;

  select count(*)::int
  into visible_count
  from public.predictions pr
  join public.matches m on m.id = pr.match_id
  where pr.pool_id = target_pool_id
    and pr.user_id = target_profile.id
    and pr.home_score is not null
    and pr.away_score is not null
    and (
      is_self
      or (m.kickoff_at is not null and m.kickoff_at <= now())
    );

  if visible_count = 0 then
    return query
    select
      target_profile.id,
      target_profile.name,
      target_profile.username,
      target_profile.avatar_url,
      is_self,
      blocked_count,
      null::uuid,
      null::uuid,
      null::uuid,
      null::text,
      null::int,
      null::timestamptz,
      null::text,
      null::text,
      null::text,
      null::text,
      null::int,
      null::int,
      null::int,
      null::int;
    return;
  end if;

  return query
  select
    target_profile.id,
    target_profile.name,
    target_profile.username,
    target_profile.avatar_url,
    is_self,
    blocked_count,
    pr.id as prediction_id,
    m.id as match_id,
    g.id as group_id,
    g.name as group_name,
    m.round_number,
    m.kickoff_at,
    home_team.name as home_team_name,
    home_team.code as home_team_code,
    away_team.name as away_team_name,
    away_team.code as away_team_code,
    pr.home_score as predicted_home_score,
    pr.away_score as predicted_away_score,
    m.home_score as actual_home_score,
    m.away_score as actual_away_score
  from public.predictions pr
  join public.matches m on m.id = pr.match_id
  join public.groups g on g.id = m.group_id
  join public.teams home_team on home_team.id = m.home_team_id
  join public.teams away_team on away_team.id = m.away_team_id
  where pr.pool_id = target_pool_id
    and pr.user_id = target_profile.id
    and pr.home_score is not null
    and pr.away_score is not null
    and (
      is_self
      or (m.kickoff_at is not null and m.kickoff_at <= now())
    )
  order by
    g.name,
    m.round_number,
    m.kickoff_at nulls last,
    m.created_at;
end;
$$;

revoke all on function public.get_visible_user_predictions_by_username(uuid, text) from public;
grant execute on function public.get_visible_user_predictions_by_username(uuid, text) to authenticated;
