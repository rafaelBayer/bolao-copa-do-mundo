alter table public.knockout_matches
add column if not exists score_provider text null,
add column if not exists score_provider_fixture_id text null,
add column if not exists status_short text null,
add column if not exists status_long text null,
add column if not exists elapsed integer null,
add column if not exists home_score_live integer null,
add column if not exists away_score_live integer null,
add column if not exists home_score integer null,
add column if not exists away_score integer null,
add column if not exists score_updated_at timestamptz null;

update public.knockout_matches
set
  score_provider = coalesce(score_provider, 'espn'),
  score_provider_fixture_id = coalesce(score_provider_fixture_id, external_match_id)
where external_match_id is not null;

create index if not exists knockout_matches_external_match_id_idx
on public.knockout_matches(external_match_id);

create index if not exists knockout_matches_score_provider_fixture_id_idx
on public.knockout_matches(score_provider, score_provider_fixture_id);

drop function if exists public.get_knockout_state(text);
create or replace function public.get_knockout_state(target_tournament_key text)
returns table (
  settings jsonb,
  matches jsonb,
  bracket jsonb,
  picks jsonb,
  is_locked boolean,
  deadline_at timestamptz,
  is_available boolean,
  lock_at timestamptz,
  first_match_starts_at timestamptz,
  user_bracket_complete boolean,
  user_picks_count integer,
  missing_picks_count integer,
  available_matches_count integer,
  open_picks_count integer,
  submitted_open_picks_count integer,
  missing_open_picks_count integer,
  locked_picks_count integer,
  next_match_at timestamptz,
  next_lock_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  settings_record public.knockout_settings%rowtype;
  bracket_record public.user_knockout_brackets%rowtype;
  configured_round_of_32_count integer := 0;
  first_round_of_32_starts_at timestamptz;
  available_count integer := 0;
  open_count integer := 0;
  submitted_open_count integer := 0;
  locked_count integer := 0;
  pick_count integer := 0;
  next_available_match_at timestamptz;
  next_available_lock_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into settings_record
  from public.knockout_settings ks
  where ks.tournament_key = target_tournament_key
    and ks.is_active;

  if settings_record.id is null then
    raise exception 'Knockout tournament not found';
  end if;

  select *
  into bracket_record
  from public.user_knockout_brackets ukb
  where ukb.tournament_key = target_tournament_key
    and ukb.user_id = current_user_id;

  select
    count(*) filter (
      where km.round = 'round_of_32'
        and km.position between 1 and 16
        and nullif(trim(coalesce(km.team_a, '')), '') is not null
        and nullif(trim(coalesce(km.team_b, '')), '') is not null
        and nullif(trim(coalesce(km.team_a_source, '')), '') is null
        and nullif(trim(coalesce(km.team_b_source, '')), '') is null
    ),
    min(km.starts_at) filter (
      where km.round = 'round_of_32'
        and km.starts_at is not null
    )
  into configured_round_of_32_count, first_round_of_32_starts_at
  from public.knockout_matches km
  where km.tournament_key = target_tournament_key;

  with available_matches as (
    select
      km.round,
      km.position,
      km.team_a,
      km.team_b,
      km.starts_at,
      km.starts_at - interval '10 minutes' as match_lock_at
    from public.knockout_matches km
    where km.tournament_key = target_tournament_key
      and public.knockout_round_points(km.round) > 0
      and nullif(trim(coalesce(km.team_a, '')), '') is not null
      and nullif(trim(coalesce(km.team_b, '')), '') is not null
      and nullif(trim(coalesce(km.team_a_source, '')), '') is null
      and nullif(trim(coalesce(km.team_b_source, '')), '') is null
  ),
  open_matches as (
    select *
    from available_matches
    where starts_at is not null
      and now() < match_lock_at
  ),
  submitted_open_picks as (
    select om.round, om.position
    from open_matches om
    join public.user_knockout_picks ukp
      on ukp.bracket_id = bracket_record.id
      and ukp.round = om.round
      and ukp.position = om.position
      and ukp.selected_team in (om.team_a, om.team_b)
  )
  select
    (select count(*) from available_matches)::integer,
    (select count(*) from open_matches)::integer,
    (select count(*) from submitted_open_picks)::integer,
    (select count(*) from available_matches where starts_at is null or now() >= match_lock_at)::integer,
    (select min(starts_at) from open_matches),
    (select min(match_lock_at) from open_matches)
  into
    available_count,
    open_count,
    submitted_open_count,
    locked_count,
    next_available_match_at,
    next_available_lock_at;

  if bracket_record.id is not null then
    select count(*)::integer
    into pick_count
    from public.user_knockout_picks ukp
    where ukp.bracket_id = bracket_record.id;
  end if;

  return query
  select
    jsonb_build_object(
      'id', settings_record.id,
      'tournamentKey', settings_record.tournament_key,
      'name', settings_record.name,
      'deadlineAt', coalesce(next_available_lock_at, settings_record.deadline_at),
      'isActive', settings_record.is_active
    ) as settings,
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', km.id,
        'tournamentKey', km.tournament_key,
        'round', km.round,
        'position', km.position,
        'externalMatchId', km.external_match_id,
        'teamASource', km.team_a_source,
        'teamA', km.team_a,
        'teamACode', km.team_a_code,
        'teamAFlagUrl', km.team_a_flag_url,
        'teamBSource', km.team_b_source,
        'teamB', km.team_b,
        'teamBCode', km.team_b_code,
        'teamBFlagUrl', km.team_b_flag_url,
        'startsAt', km.starts_at,
        'lockAt', case when km.starts_at is null then null else km.starts_at - interval '10 minutes' end,
        'statusShort', km.status_short,
        'statusLong', km.status_long,
        'elapsed', km.elapsed,
        'homeScoreLive', km.home_score_live,
        'awayScoreLive', km.away_score_live,
        'homeScore', km.home_score,
        'awayScore', km.away_score,
        'scoreUpdatedAt', km.score_updated_at,
        'isLocked', km.starts_at is null or now() >= km.starts_at - interval '10 minutes',
        'canPick',
          public.knockout_round_points(km.round) > 0
          and km.starts_at is not null
          and now() < km.starts_at - interval '10 minutes'
          and nullif(trim(coalesce(km.team_a, '')), '') is not null
          and nullif(trim(coalesce(km.team_b, '')), '') is not null
          and nullif(trim(coalesce(km.team_a_source, '')), '') is null
          and nullif(trim(coalesce(km.team_b_source, '')), '') is null,
        'userPick', ukp.selected_team,
        'pointsIfCorrect', public.knockout_round_points(km.round),
        'isFinished', km.winner_team is not null,
        'isPickCorrect', case
          when ukp.id is null or km.winner_team is null then null
          else ukp.selected_team = km.winner_team
            and ukp.selected_team in (km.team_a, km.team_b)
        end,
        'pickPoints', case
          when ukp.selected_team = km.winner_team
            and ukp.selected_team in (km.team_a, km.team_b)
          then public.knockout_round_points(km.round)
          else 0
        end,
        'winnerTeam', km.winner_team,
        'winnerTeamCode', km.winner_team_code
      ) order by public.knockout_round_order(km.round), km.position), '[]'::jsonb)
      from public.knockout_matches km
      left join public.user_knockout_picks ukp
        on ukp.bracket_id = bracket_record.id
        and ukp.round = km.round
        and ukp.position = km.position
      where km.tournament_key = target_tournament_key
    ) as matches,
    case
      when bracket_record.id is null then null::jsonb
      else jsonb_build_object(
        'id', bracket_record.id,
        'userId', bracket_record.user_id,
        'tournamentKey', bracket_record.tournament_key,
        'submittedAt', bracket_record.submitted_at,
        'completedAt', bracket_record.completed_at,
        'createdAt', bracket_record.created_at,
        'updatedAt', bracket_record.updated_at
      )
    end as bracket,
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', ukp.id,
        'round', ukp.round,
        'position', ukp.position,
        'selectedTeam', ukp.selected_team,
        'createdAt', ukp.created_at,
        'updatedAt', ukp.updated_at
      ) order by public.knockout_round_order(ukp.round), ukp.position), '[]'::jsonb)
      from public.user_knockout_picks ukp
      where ukp.bracket_id = bracket_record.id
    ) as picks,
    open_count = 0 as is_locked,
    coalesce(next_available_lock_at, settings_record.deadline_at) as deadline_at,
    available_count > 0 as is_available,
    next_available_lock_at as lock_at,
    first_round_of_32_starts_at as first_match_starts_at,
    open_count > 0 and submitted_open_count = open_count as user_bracket_complete,
    pick_count as user_picks_count,
    greatest(open_count - submitted_open_count, 0) as missing_picks_count,
    available_count as available_matches_count,
    open_count as open_picks_count,
    submitted_open_count as submitted_open_picks_count,
    greatest(open_count - submitted_open_count, 0) as missing_open_picks_count,
    locked_count as locked_picks_count,
    next_available_match_at as next_match_at,
    next_available_lock_at as next_lock_at;
end;
$$;

revoke all on function public.get_knockout_state(text) from public;
grant execute on function public.get_knockout_state(text) to authenticated;

notify pgrst, 'reload schema';
