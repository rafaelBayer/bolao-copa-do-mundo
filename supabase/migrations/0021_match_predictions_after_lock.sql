drop function if exists public.get_match_predictions_after_lock(uuid, uuid);

create or replace function public.get_match_predictions_after_lock(
  target_pool_id uuid,
  target_match_id uuid
)
returns table (
  user_id uuid,
  participant_name text,
  participant_avatar_url text,
  is_current_user boolean,
  home_score integer,
  away_score integer,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  match_kickoff_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can view match predictions';
  end if;

  select m.kickoff_at
  into match_kickoff_at
  from public.matches m
  where m.id = target_match_id;

  if not found then
    raise exception 'Match not found';
  end if;

  if match_kickoff_at is null or now() < match_kickoff_at - interval '1 hour' then
    raise exception 'Match predictions are not visible yet';
  end if;

  return query
  select
    pr.user_id,
    coalesce(nullif(p.name, ''), 'Participante') as participant_name,
    p.avatar_url as participant_avatar_url,
    pr.user_id = current_user_id as is_current_user,
    pr.home_score,
    pr.away_score,
    pr.updated_at
  from public.predictions pr
  left join public.profiles p on p.id = pr.user_id
  where pr.pool_id = target_pool_id
    and pr.match_id = target_match_id
    and pr.home_score is not null
    and pr.away_score is not null
  order by
    coalesce(nullif(p.name, ''), 'Participante'),
    pr.updated_at;
end;
$$;

revoke all on function public.get_match_predictions_after_lock(uuid, uuid) from public;
grant execute on function public.get_match_predictions_after_lock(uuid, uuid) to authenticated;
