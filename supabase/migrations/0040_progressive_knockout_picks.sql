create or replace function public.knockout_round_points(round_value text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case round_value
    when 'round_of_32' then 2
    when 'round_of_16' then 3
    when 'quarterfinal' then 5
    when 'semifinal' then 8
    when 'final' then 12
    else 0
  end;
$$;

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

drop function if exists public.get_knockout_notice_state(text);
create or replace function public.get_knockout_notice_state(target_tournament_key text)
returns table (
  is_available boolean,
  is_locked boolean,
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
  bracket_id uuid;
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
    return query
    select false, true, null::timestamptz, null::timestamptz, false, 0, 0,
      0, 0, 0, 0, 0, null::timestamptz, null::timestamptz;
    return;
  end if;

  select ukb.id
  into bracket_id
  from public.user_knockout_brackets ukb
  where ukb.tournament_key = target_tournament_key
    and ukb.user_id = current_user_id;

  select min(km.starts_at) filter (
    where km.round = 'round_of_32'
      and km.starts_at is not null
  )
  into first_round_of_32_starts_at
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
      on ukp.bracket_id = bracket_id
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

  if bracket_id is not null then
    select count(*)::integer
    into pick_count
    from public.user_knockout_picks ukp
    where ukp.bracket_id = bracket_id;
  end if;

  return query
  select
    available_count > 0,
    open_count = 0,
    next_available_lock_at,
    first_round_of_32_starts_at,
    open_count > 0 and submitted_open_count = open_count,
    pick_count,
    greatest(open_count - submitted_open_count, 0),
    available_count,
    open_count,
    submitted_open_count,
    greatest(open_count - submitted_open_count, 0),
    locked_count,
    next_available_match_at,
    next_available_lock_at;
end;
$$;

drop function if exists public.save_knockout_bracket(text, jsonb);
drop function if exists public.save_knockout_pick(text, text, integer, text);
create or replace function public.save_knockout_pick(
  target_tournament_key text,
  target_round text,
  target_position integer,
  target_selected_team text
)
returns table (
  bracket jsonb,
  pick jsonb,
  picks jsonb
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  current_user_id uuid := auth.uid();
  settings_record public.knockout_settings%rowtype;
  match_record public.knockout_matches%rowtype;
  bracket_id uuid;
  selected_team_value text := nullif(trim(target_selected_team), '');
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

  if public.knockout_round_points(lower(trim(target_round))) = 0 then
    raise exception 'Confronto indisponivel para palpite.';
  end if;

  select *
  into match_record
  from public.knockout_matches km
  where km.tournament_key = target_tournament_key
    and km.round = lower(trim(target_round))
    and km.position = target_position;

  if match_record.id is null then
    raise exception 'Confronto nao encontrado.';
  end if;

  if nullif(trim(coalesce(match_record.team_a, '')), '') is null
    or nullif(trim(coalesce(match_record.team_b, '')), '') is null
    or nullif(trim(coalesce(match_record.team_a_source, '')), '') is not null
    or nullif(trim(coalesce(match_record.team_b_source, '')), '') is not null
  then
    raise exception 'Aguardando definicao dos classificados.';
  end if;

  if match_record.starts_at is null then
    raise exception 'Horario do confronto ainda nao definido.';
  end if;

  if now() >= match_record.starts_at - interval '10 minutes' then
    raise exception 'Palpite bloqueado para este confronto.';
  end if;

  if selected_team_value is null
    or selected_team_value not in (match_record.team_a, match_record.team_b)
  then
    raise exception 'Time selecionado nao participa deste confronto.';
  end if;

  insert into public.user_knockout_brackets as target_bracket (
    user_id,
    tournament_key,
    submitted_at,
    updated_at
  )
  values (
    current_user_id,
    target_tournament_key,
    now(),
    now()
  )
  on conflict (user_id, tournament_key)
  do update set
    submitted_at = now(),
    updated_at = now()
  returning target_bracket.id into bracket_id;

  insert into public.user_knockout_picks as target_pick (
    bracket_id,
    round,
    position,
    selected_team
  )
  values (
    bracket_id,
    match_record.round,
    match_record.position,
    selected_team_value
  )
  on conflict (bracket_id, round, position)
  do update set
    selected_team = excluded.selected_team,
    updated_at = now();

  return query
  select
    jsonb_build_object(
      'id', ukb.id,
      'userId', ukb.user_id,
      'tournamentKey', ukb.tournament_key,
      'submittedAt', ukb.submitted_at,
      'completedAt', ukb.completed_at,
      'createdAt', ukb.created_at,
      'updatedAt', ukb.updated_at
    ) as bracket,
    (
      select jsonb_build_object(
        'id', ukp.id,
        'round', ukp.round,
        'position', ukp.position,
        'selectedTeam', ukp.selected_team,
        'createdAt', ukp.created_at,
        'updatedAt', ukp.updated_at
      )
      from public.user_knockout_picks ukp
      where ukp.bracket_id = ukb.id
        and ukp.round = match_record.round
        and ukp.position = match_record.position
    ) as pick,
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
      where ukp.bracket_id = ukb.id
    ) as picks
  from public.user_knockout_brackets ukb
  where ukb.id = bracket_id;
end;
$$;

drop function if exists public.get_pool_knockout_ranking(uuid, text);
create or replace function public.get_pool_knockout_ranking(
  target_pool_id uuid,
  target_tournament_key text
)
returns table (
  user_id uuid,
  profile_name text,
  username text,
  avatar_url text,
  total_points integer,
  correct_picks integer,
  submitted_at timestamptz,
  completed_at timestamptz,
  picks_count integer,
  is_complete boolean,
  round_of_32_points integer,
  round_of_16_points integer,
  quarterfinal_points integer,
  semifinal_points integer,
  final_points integer,
  round_of_32_correct integer,
  round_of_16_correct integer,
  quarterfinal_correct integer,
  semifinal_correct integer,
  final_correct integer
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
    raise exception 'Only pool members can view knockout ranking';
  end if;

  return query
  with available_matches as (
    select
      km.round,
      km.position,
      km.team_a,
      km.team_b,
      km.winner_team,
      public.knockout_round_points(km.round) as points
    from public.knockout_matches km
    where km.tournament_key = target_tournament_key
      and public.knockout_round_points(km.round) > 0
      and nullif(trim(coalesce(km.team_a, '')), '') is not null
      and nullif(trim(coalesce(km.team_b, '')), '') is not null
      and nullif(trim(coalesce(km.team_a_source, '')), '') is null
      and nullif(trim(coalesce(km.team_b_source, '')), '') is null
  ),
  member_scores as (
    select
      pm.user_id,
      ukb.submitted_at,
      ukb.completed_at,
      coalesce(count(ukp.id) filter (
        where am.round is not null
          and ukp.selected_team in (am.team_a, am.team_b)
      ), 0)::integer as picks_count,
      (
        coalesce(count(ukp.id) filter (
          where am.round is not null
            and ukp.selected_team in (am.team_a, am.team_b)
        ), 0) = (select count(*) from available_matches)
        and (select count(*) from available_matches) > 0
      ) as is_complete,
      coalesce(sum(
        case
          when am.winner_team is not null
            and ukp.selected_team = am.winner_team
            and ukp.selected_team in (am.team_a, am.team_b)
          then am.points
          else 0
        end
      ), 0)::integer as total_points,
      coalesce(count(ukp.id) filter (
        where am.winner_team is not null
          and ukp.selected_team = am.winner_team
          and ukp.selected_team in (am.team_a, am.team_b)
      ), 0)::integer as correct_picks,
      coalesce(sum(
        case when ukp.round = 'round_of_32'
          and am.winner_team is not null
          and ukp.selected_team = am.winner_team
          and ukp.selected_team in (am.team_a, am.team_b)
        then am.points else 0 end
      ), 0)::integer as round_of_32_points,
      coalesce(sum(
        case when ukp.round = 'round_of_16'
          and am.winner_team is not null
          and ukp.selected_team = am.winner_team
          and ukp.selected_team in (am.team_a, am.team_b)
        then am.points else 0 end
      ), 0)::integer as round_of_16_points,
      coalesce(sum(
        case when ukp.round = 'quarterfinal'
          and am.winner_team is not null
          and ukp.selected_team = am.winner_team
          and ukp.selected_team in (am.team_a, am.team_b)
        then am.points else 0 end
      ), 0)::integer as quarterfinal_points,
      coalesce(sum(
        case when ukp.round = 'semifinal'
          and am.winner_team is not null
          and ukp.selected_team = am.winner_team
          and ukp.selected_team in (am.team_a, am.team_b)
        then am.points else 0 end
      ), 0)::integer as semifinal_points,
      coalesce(sum(
        case when ukp.round = 'final'
          and am.winner_team is not null
          and ukp.selected_team = am.winner_team
          and ukp.selected_team in (am.team_a, am.team_b)
        then am.points else 0 end
      ), 0)::integer as final_points,
      coalesce(count(ukp.id) filter (
        where ukp.round = 'round_of_32'
          and am.winner_team is not null
          and ukp.selected_team = am.winner_team
          and ukp.selected_team in (am.team_a, am.team_b)
      ), 0)::integer as round_of_32_correct,
      coalesce(count(ukp.id) filter (
        where ukp.round = 'round_of_16'
          and am.winner_team is not null
          and ukp.selected_team = am.winner_team
          and ukp.selected_team in (am.team_a, am.team_b)
      ), 0)::integer as round_of_16_correct,
      coalesce(count(ukp.id) filter (
        where ukp.round = 'quarterfinal'
          and am.winner_team is not null
          and ukp.selected_team = am.winner_team
          and ukp.selected_team in (am.team_a, am.team_b)
      ), 0)::integer as quarterfinal_correct,
      coalesce(count(ukp.id) filter (
        where ukp.round = 'semifinal'
          and am.winner_team is not null
          and ukp.selected_team = am.winner_team
          and ukp.selected_team in (am.team_a, am.team_b)
      ), 0)::integer as semifinal_correct,
      coalesce(count(ukp.id) filter (
        where ukp.round = 'final'
          and am.winner_team is not null
          and ukp.selected_team = am.winner_team
          and ukp.selected_team in (am.team_a, am.team_b)
      ), 0)::integer as final_correct
    from public.pool_members pm
    left join public.user_knockout_brackets ukb
      on ukb.user_id = pm.user_id
      and ukb.tournament_key = target_tournament_key
    left join public.user_knockout_picks ukp
      on ukp.bracket_id = ukb.id
    left join available_matches am
      on am.round = ukp.round
      and am.position = ukp.position
    where pm.pool_id = target_pool_id
    group by pm.user_id, ukb.submitted_at, ukb.completed_at
  )
  select
    ms.user_id,
    p.name as profile_name,
    p.username,
    p.avatar_url,
    ms.total_points,
    ms.correct_picks,
    ms.submitted_at,
    ms.completed_at,
    ms.picks_count,
    ms.is_complete,
    ms.round_of_32_points,
    ms.round_of_16_points,
    ms.quarterfinal_points,
    ms.semifinal_points,
    ms.final_points,
    ms.round_of_32_correct,
    ms.round_of_16_correct,
    ms.quarterfinal_correct,
    ms.semifinal_correct,
    ms.final_correct
  from member_scores ms
  left join public.profiles p on p.id = ms.user_id
  order by
    ms.total_points desc,
    ms.correct_picks desc,
    ms.submitted_at asc nulls last,
    lower(coalesce(p.name, '')),
    ms.user_id;
end;
$$;

revoke all on function public.knockout_round_points(text) from public;
revoke all on function public.get_knockout_state(text) from public;
revoke all on function public.get_knockout_notice_state(text) from public;
revoke all on function public.save_knockout_pick(text, text, integer, text) from public;
revoke all on function public.get_pool_knockout_ranking(uuid, text) from public;

grant execute on function public.get_knockout_state(text) to authenticated;
grant execute on function public.get_knockout_notice_state(text) to authenticated;
grant execute on function public.save_knockout_pick(text, text, integer, text) to authenticated;
grant execute on function public.get_pool_knockout_ranking(uuid, text) to authenticated;

notify pgrst, 'reload schema';
