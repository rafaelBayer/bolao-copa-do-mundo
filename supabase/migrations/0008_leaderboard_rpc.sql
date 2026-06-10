create or replace function public.get_pool_leaderboard_data(target_pool_id uuid)
returns table (
  user_id uuid,
  profile_name text,
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

revoke all on function public.get_pool_leaderboard_data(uuid) from public;
grant execute on function public.get_pool_leaderboard_data(uuid) to authenticated;
