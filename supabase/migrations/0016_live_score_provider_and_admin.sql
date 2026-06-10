alter table public.matches
add column if not exists score_provider text,
add column if not exists score_provider_fixture_id text;

create index if not exists matches_score_provider_fixture_idx
on public.matches(score_provider, score_provider_fixture_id)
where score_provider_fixture_id is not null;

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

  if not public.is_pool_owner(target_pool_id) then
    raise exception 'Only pool owners can update live scores';
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

  if not public.is_pool_owner(target_pool_id) then
    raise exception 'Only pool owners can finalize scores';
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
