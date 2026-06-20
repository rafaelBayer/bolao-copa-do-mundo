alter table public.pools
add column if not exists description text;

alter table public.pools
add column if not exists type text not null default 'private';

alter table public.pools
add column if not exists is_default boolean not null default false;

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

create index if not exists predictions_user_match_idx
on public.predictions(user_id, match_id, updated_at desc);

create or replace function public.ensure_default_pool_membership(
  preferred_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  default_pool_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtext('default-pool'));

  select p.id
  into default_pool_id
  from public.pools p
  where p.is_default
  order by p.created_at, p.id
  limit 1;

  if default_pool_id is null then
    insert into public.pools (
      name,
      description,
      type,
      is_default,
      owner_id
    )
    values (
      'Bolao Geral',
      'Bolao padrao para todos os participantes.',
      'general',
      true,
      null
    )
    returning id into default_pool_id;
  end if;

  insert into public.pool_members (
    pool_id,
    user_id,
    role
  )
  values (
    default_pool_id,
    current_user_id,
    'member'
  )
  on conflict (pool_id, user_id) do nothing;

  perform *
  from public.ensure_user_profile_for_pool(default_pool_id, preferred_name);

  return default_pool_id;
end;
$$;

revoke all on function public.ensure_default_pool_membership(text) from public;
grant execute on function public.ensure_default_pool_membership(text) to authenticated;

create or replace function public.save_prediction(
  target_pool_id uuid,
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
  match_kickoff_at timestamptz;
  existing_prediction_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can save predictions';
  end if;

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

  perform pg_advisory_xact_lock(
    hashtext('prediction:' || current_user_id::text || ':' || target_match_id::text)
  );

  select pr.id
  into existing_prediction_id
  from public.predictions pr
  where pr.user_id = current_user_id
    and pr.match_id = target_match_id
  order by pr.updated_at desc, pr.created_at desc, pr.id
  limit 1;

  if existing_prediction_id is not null then
    return query
    update public.predictions as target_prediction
    set
      home_score = predicted_home_score,
      away_score = predicted_away_score,
      updated_at = now()
    where target_prediction.id = existing_prediction_id
    returning
      target_prediction.id,
      target_pool_id,
      target_prediction.user_id,
      target_prediction.match_id,
      target_prediction.home_score,
      target_prediction.away_score,
      target_prediction.created_at,
      target_prediction.updated_at;

    return;
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
    target_pool_id,
    current_user_id,
    target_match_id,
    predicted_home_score,
    predicted_away_score,
    now()
  )
  returning
    target_prediction.id,
    target_pool_id,
    target_prediction.user_id,
    target_prediction.match_id,
    target_prediction.home_score,
    target_prediction.away_score,
    target_prediction.created_at,
    target_prediction.updated_at;
end;
$$;

revoke all on function public.save_prediction(uuid, uuid, integer, integer) from public;
grant execute on function public.save_prediction(uuid, uuid, integer, integer) to authenticated;

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
    pm.user_id,
    coalesce(nullif(p.name, ''), 'Participante') as participant_name,
    p.avatar_url as participant_avatar_url,
    pm.user_id = current_user_id as is_current_user,
    pr.home_score,
    pr.away_score,
    pr.updated_at
  from public.pool_members pm
  join lateral (
    select latest_pr.*
    from public.predictions latest_pr
    where latest_pr.user_id = pm.user_id
      and latest_pr.match_id = target_match_id
      and latest_pr.home_score is not null
      and latest_pr.away_score is not null
    order by latest_pr.updated_at desc, latest_pr.created_at desc, latest_pr.id
    limit 1
  ) pr on true
  left join public.profiles p on p.id = pm.user_id
  where pm.pool_id = target_pool_id
  order by
    coalesce(nullif(p.name, ''), 'Participante'),
    pr.updated_at;
end;
$$;

revoke all on function public.get_match_predictions_after_lock(uuid, uuid) from public;
grant execute on function public.get_match_predictions_after_lock(uuid, uuid) to authenticated;

create or replace function public.get_visible_user_predictions_by_username(
  p_target_pool_id uuid,
  p_target_username text
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

  if not public.is_pool_member(p_target_pool_id) then
    raise exception 'Only pool members can view public profiles';
  end if;

  select *
  into target_profile
  from public.profiles p
  where lower(p.username) = lower(public.slugify_username(p_target_username));

  if target_profile.id is null then
    raise exception 'Profile not found';
  end if;

  if not exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = p_target_pool_id
      and pm.user_id = target_profile.id
  ) then
    raise exception 'Profile not found in this pool';
  end if;

  is_self := target_profile.id = current_user_id;

  if not is_self then
    with latest_predictions as (
      select distinct on (pr.user_id, pr.match_id)
        pr.*
      from public.predictions pr
      where pr.user_id = target_profile.id
      order by pr.user_id, pr.match_id, pr.updated_at desc, pr.created_at desc, pr.id
    )
    select count(*)::int
    into blocked_count
    from latest_predictions pr
    join public.matches m on m.id = pr.match_id
    where pr.home_score is not null
      and pr.away_score is not null
      and (m.kickoff_at is null or m.kickoff_at > now());
  end if;

  with latest_predictions as (
    select distinct on (pr.user_id, pr.match_id)
      pr.*
    from public.predictions pr
    where pr.user_id = target_profile.id
    order by pr.user_id, pr.match_id, pr.updated_at desc, pr.created_at desc, pr.id
  )
  select count(*)::int
  into visible_count
  from latest_predictions pr
  join public.matches m on m.id = pr.match_id
  where pr.home_score is not null
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
  with latest_predictions as (
    select distinct on (pr.user_id, pr.match_id)
      pr.*
    from public.predictions pr
    where pr.user_id = target_profile.id
    order by pr.user_id, pr.match_id, pr.updated_at desc, pr.created_at desc, pr.id
  )
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
  from latest_predictions pr
  join public.matches m on m.id = pr.match_id
  join public.groups g on g.id = m.group_id
  join public.teams home_team on home_team.id = m.home_team_id
  join public.teams away_team on away_team.id = m.away_team_id
  where pr.home_score is not null
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

create or replace function public.get_pool_recent_activity(
  target_pool_id uuid,
  target_limit int default 5
)
returns table (
  activity_type text,
  activity_id text,
  occurred_at timestamptz,
  title text,
  description text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_limit int := greatest(1, least(coalesce(target_limit, 5), 10));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can view recent activity';
  end if;

  return query
  with exact_predictions as (
    select
      m.id as match_id,
      coalesce(m.score_updated_at, m.updated_at, m.created_at) as occurred_at,
      ht.name as home_team_name,
      at.name as away_team_name,
      count(*)::int as exact_count,
      min(coalesce(nullif(trim(p.name), ''), 'Participante')) as participant_name
    from public.matches m
    join public.teams ht on ht.id = m.home_team_id
    join public.teams at on at.id = m.away_team_id
    join public.pool_members pm on pm.pool_id = target_pool_id
    join lateral (
      select latest_pr.*
      from public.predictions latest_pr
      where latest_pr.user_id = pm.user_id
        and latest_pr.match_id = m.id
        and latest_pr.home_score = m.home_score
        and latest_pr.away_score = m.away_score
      order by latest_pr.updated_at desc, latest_pr.created_at desc, latest_pr.id
      limit 1
    ) pr on true
    left join public.profiles p on p.id = pr.user_id
    where upper(coalesce(m.status_short, '')) in ('FT', 'AET', 'PEN')
      and m.home_score is not null
      and m.away_score is not null
      and pr.home_score is not null
      and pr.away_score is not null
    group by
      m.id,
      coalesce(m.score_updated_at, m.updated_at, m.created_at),
      ht.name,
      at.name
  ),
  activity as (
    select
      'goal'::text as activity_type,
      'goal:' || mg.id::text as activity_id,
      coalesce(mg.created_at, m.score_updated_at, m.updated_at, m.created_at) as occurred_at,
      case
        when mg.minute is null then 'Gol do ' || coalesce(mg.team_name, ht.name)
        else mg.minute::text || ''' - Gol do ' || coalesce(mg.team_name, ht.name)
      end as title,
      coalesce(nullif(trim(mg.player_name), ''), ht.name || ' x ' || at.name) as description
    from public.match_goals mg
    join public.matches m on m.id = mg.match_id
    join public.teams ht on ht.id = m.home_team_id
    join public.teams at on at.id = m.away_team_id

    union all

    select
      'match_finished'::text as activity_type,
      'match_finished:' || m.id::text as activity_id,
      coalesce(m.score_updated_at, m.updated_at, m.created_at) as occurred_at,
      'Fim de jogo'::text as title,
      ht.name || ' ' || m.home_score::text || ' x ' || m.away_score::text || ' ' || at.name as description
    from public.matches m
    join public.teams ht on ht.id = m.home_team_id
    join public.teams at on at.id = m.away_team_id
    where upper(coalesce(m.status_short, '')) in ('FT', 'AET', 'PEN')
      and m.home_score is not null
      and m.away_score is not null

    union all

    select
      'exact_score'::text as activity_type,
      'exact_score:' || ep.match_id::text as activity_id,
      ep.occurred_at + interval '1 second' as occurred_at,
      'Placar exato'::text as title,
      case
        when ep.exact_count = 1 then
          ep.participant_name || ' acertou o placar exato em ' || ep.home_team_name || ' x ' || ep.away_team_name || '.'
        else
          ep.exact_count::text || ' participantes acertaram o placar exato em ' || ep.home_team_name || ' x ' || ep.away_team_name || '.'
      end as description
    from exact_predictions ep
  )
  select
    activity.activity_type,
    activity.activity_id,
    activity.occurred_at,
    activity.title,
    activity.description
  from activity
  order by activity.occurred_at desc, activity.activity_id desc
  limit safe_limit;
end;
$$;

revoke all on function public.get_pool_recent_activity(uuid, int) from public;
grant execute on function public.get_pool_recent_activity(uuid, int) to authenticated;
