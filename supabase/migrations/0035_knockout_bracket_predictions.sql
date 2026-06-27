create table if not exists public.knockout_settings (
  id uuid primary key default gen_random_uuid(),
  tournament_key text not null unique,
  name text not null,
  deadline_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knockout_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_key text not null references public.knockout_settings(tournament_key) on delete cascade,
  round text not null check (
    round in (
      'round_of_32',
      'round_of_16',
      'quarterfinal',
      'semifinal',
      'final'
    )
  ),
  position integer not null,
  external_match_id text null,
  team_a_source text null,
  team_a text null,
  team_a_code text null,
  team_a_flag_url text null,
  team_b_source text null,
  team_b text null,
  team_b_code text null,
  team_b_flag_url text null,
  starts_at timestamptz null,
  winner_team text null,
  winner_team_code text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tournament_key, round, position)
);

create table if not exists public.user_knockout_brackets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tournament_key text not null references public.knockout_settings(tournament_key) on delete cascade,
  submitted_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, tournament_key)
);

create table if not exists public.user_knockout_picks (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references public.user_knockout_brackets(id) on delete cascade,
  round text not null check (
    round in (
      'round_of_32',
      'round_of_16',
      'quarterfinal',
      'semifinal',
      'final'
    )
  ),
  position integer not null,
  selected_team text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(bracket_id, round, position)
);

create index if not exists knockout_matches_tournament_round_idx
on public.knockout_matches(tournament_key, round, position);

create index if not exists user_knockout_brackets_user_idx
on public.user_knockout_brackets(user_id, tournament_key);

create index if not exists user_knockout_picks_bracket_idx
on public.user_knockout_picks(bracket_id, round, position);

drop trigger if exists knockout_settings_touch_updated_at on public.knockout_settings;
create trigger knockout_settings_touch_updated_at
before update on public.knockout_settings
for each row execute function public.touch_updated_at();

drop trigger if exists knockout_matches_touch_updated_at on public.knockout_matches;
create trigger knockout_matches_touch_updated_at
before update on public.knockout_matches
for each row execute function public.touch_updated_at();

drop trigger if exists user_knockout_brackets_touch_updated_at on public.user_knockout_brackets;
create trigger user_knockout_brackets_touch_updated_at
before update on public.user_knockout_brackets
for each row execute function public.touch_updated_at();

drop trigger if exists user_knockout_picks_touch_updated_at on public.user_knockout_picks;
create trigger user_knockout_picks_touch_updated_at
before update on public.user_knockout_picks
for each row execute function public.touch_updated_at();

alter table public.knockout_settings enable row level security;
alter table public.knockout_matches enable row level security;
alter table public.user_knockout_brackets enable row level security;
alter table public.user_knockout_picks enable row level security;

drop policy if exists "Authenticated users can view active knockout settings" on public.knockout_settings;
create policy "Authenticated users can view active knockout settings"
on public.knockout_settings for select
to authenticated
using (is_active);

drop policy if exists "System admins can manage knockout settings" on public.knockout_settings;
create policy "System admins can manage knockout settings"
on public.knockout_settings for all
to authenticated
using (public.is_system_admin())
with check (public.is_system_admin());

drop policy if exists "Authenticated users can view knockout matches" on public.knockout_matches;
create policy "Authenticated users can view knockout matches"
on public.knockout_matches for select
to authenticated
using (
  exists (
    select 1
    from public.knockout_settings ks
    where ks.tournament_key = knockout_matches.tournament_key
      and ks.is_active
  )
);

drop policy if exists "System admins can manage knockout matches" on public.knockout_matches;
create policy "System admins can manage knockout matches"
on public.knockout_matches for all
to authenticated
using (public.is_system_admin())
with check (public.is_system_admin());

drop policy if exists "Users can view own knockout brackets" on public.user_knockout_brackets;
create policy "Users can view own knockout brackets"
on public.user_knockout_brackets for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can view own knockout picks" on public.user_knockout_picks;
create policy "Users can view own knockout picks"
on public.user_knockout_picks for select
to authenticated
using (
  exists (
    select 1
    from public.user_knockout_brackets ukb
    where ukb.id = user_knockout_picks.bracket_id
      and ukb.user_id = auth.uid()
  )
);

create or replace function public.knockout_round_order(round_value text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case round_value
    when 'round_of_32' then 1
    when 'round_of_16' then 2
    when 'quarterfinal' then 3
    when 'semifinal' then 4
    when 'final' then 5
    else 99
  end;
$$;

create or replace function public.knockout_expected_positions(round_value text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case round_value
    when 'round_of_32' then 16
    when 'round_of_16' then 8
    when 'quarterfinal' then 4
    when 'semifinal' then 2
    when 'final' then 1
    else 0
  end;
$$;

create or replace function public.get_knockout_state(target_tournament_key text)
returns table (
  settings jsonb,
  matches jsonb,
  bracket jsonb,
  picks jsonb,
  is_locked boolean,
  deadline_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  settings_record public.knockout_settings%rowtype;
  bracket_record public.user_knockout_brackets%rowtype;
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

  return query
  select
    jsonb_build_object(
      'id', settings_record.id,
      'tournamentKey', settings_record.tournament_key,
      'name', settings_record.name,
      'deadlineAt', settings_record.deadline_at,
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
        'winnerTeam', km.winner_team,
        'winnerTeamCode', km.winner_team_code
      ) order by public.knockout_round_order(km.round), km.position), '[]'::jsonb)
      from public.knockout_matches km
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
    now() >= settings_record.deadline_at as is_locked,
    settings_record.deadline_at as deadline_at;
end;
$$;

create or replace function public.save_knockout_bracket(
  target_tournament_key text,
  target_picks jsonb
)
returns table (
  bracket jsonb,
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
  bracket_id uuid;
  total_picks integer;
  invalid_count integer;
  is_complete boolean;
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

  if now() >= settings_record.deadline_at then
    raise exception 'Knockout bracket is locked';
  end if;

  if jsonb_typeof(target_picks) <> 'array' then
    raise exception 'Knockout picks must be an array';
  end if;

  with submitted as (
    select
      lower(trim(p.round)) as round,
      p.position::integer as position,
      nullif(trim(p.selected_team), '') as selected_team
    from jsonb_to_recordset(target_picks) as p(
      round text,
      position integer,
      selected_team text
    )
  )
  select count(*)
  into total_picks
  from submitted;

  with submitted as (
    select
      lower(trim(p.round)) as round,
      p.position::integer as position,
      nullif(trim(p.selected_team), '') as selected_team
    from jsonb_to_recordset(target_picks) as p(
      round text,
      position integer,
      selected_team text
    )
  ),
  duplicate_picks as (
    select round, position
    from submitted
    group by round, position
    having count(*) > 1
  ),
  invalid_shape as (
    select submitted.*
    from submitted
    where selected_team is null
      or public.knockout_expected_positions(round) = 0
      or position < 1
      or position > public.knockout_expected_positions(round)
  ),
  r32 as (
    select s.position, s.selected_team
    from submitted s
    join public.knockout_matches km
      on km.tournament_key = target_tournament_key
      and km.round = 'round_of_32'
      and km.position = s.position
    where s.round = 'round_of_32'
      and s.selected_team in (km.team_a, km.team_b)
  ),
  r16_allowed as (
    select ((r32.position + 1) / 2)::integer as position, r32.selected_team
    from r32
  ),
  r16 as (
    select s.position, s.selected_team
    from submitted s
    join r16_allowed allowed
      on allowed.position = s.position
      and allowed.selected_team = s.selected_team
    where s.round = 'round_of_16'
  ),
  qf_allowed as (
    select ((r16.position + 1) / 2)::integer as position, r16.selected_team
    from r16
  ),
  qf as (
    select s.position, s.selected_team
    from submitted s
    join qf_allowed allowed
      on allowed.position = s.position
      and allowed.selected_team = s.selected_team
    where s.round = 'quarterfinal'
  ),
  sf_allowed as (
    select ((qf.position + 1) / 2)::integer as position, qf.selected_team
    from qf
  ),
  sf as (
    select s.position, s.selected_team
    from submitted s
    join sf_allowed allowed
      on allowed.position = s.position
      and allowed.selected_team = s.selected_team
    where s.round = 'semifinal'
  ),
  final_allowed as (
    select 1 as position, sf.selected_team
    from sf
  ),
  final_pick as (
    select s.position, s.selected_team
    from submitted s
    join final_allowed allowed
      on allowed.position = s.position
      and allowed.selected_team = s.selected_team
    where s.round = 'final'
  ),
  valid_picks as (
    select 'round_of_32'::text as round, position, selected_team from r32
    union all
    select 'round_of_16', position, selected_team from r16
    union all
    select 'quarterfinal', position, selected_team from qf
    union all
    select 'semifinal', position, selected_team from sf
    union all
    select 'final', position, selected_team from final_pick
  )
  select
    (
      select count(*) from duplicate_picks
    ) + (
      select count(*) from invalid_shape
    ) + (
      select count(*) from submitted
    ) - (
      select count(*) from valid_picks
    )
  into invalid_count;

  if invalid_count <> 0 then
    raise exception 'Knockout bracket is inconsistent';
  end if;

  with submitted as (
    select
      lower(trim(p.round)) as round,
      p.position::integer as position
    from jsonb_to_recordset(target_picks) as p(
      round text,
      position integer,
      selected_team text
    )
  )
  select
    count(*) = 31
    and count(*) filter (where round = 'round_of_32') = 16
    and count(*) filter (where round = 'round_of_16') = 8
    and count(*) filter (where round = 'quarterfinal') = 4
    and count(*) filter (where round = 'semifinal') = 2
    and count(*) filter (where round = 'final') = 1
  into is_complete
  from submitted;

  insert into public.user_knockout_brackets as target_bracket (
    user_id,
    tournament_key,
    submitted_at,
    completed_at,
    updated_at
  )
  values (
    current_user_id,
    target_tournament_key,
    now(),
    case when is_complete then now() else null end,
    now()
  )
  on conflict (user_id, tournament_key)
  do update set
    submitted_at = now(),
    completed_at = case
      when is_complete then coalesce(target_bracket.completed_at, now())
      else null
    end,
    updated_at = now()
  returning target_bracket.id into bracket_id;

  delete from public.user_knockout_picks ukp
  where ukp.bracket_id = bracket_id;

  insert into public.user_knockout_picks (
    bracket_id,
    round,
    position,
    selected_team
  )
  select
    bracket_id,
    lower(trim(p.round)),
    p.position::integer,
    trim(p.selected_team)
  from jsonb_to_recordset(target_picks) as p(
    round text,
    position integer,
    selected_team text
  );

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
  submitted_at timestamptz
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
  with official_winners as (
    select
      km.round,
      km.position,
      km.winner_team,
      case km.round
        when 'round_of_32' then 2
        when 'round_of_16' then 4
        when 'quarterfinal' then 6
        when 'semifinal' then 10
        when 'final' then 15
        else 0
      end as points
    from public.knockout_matches km
    where km.tournament_key = target_tournament_key
      and km.round in ('round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'final')
      and km.winner_team is not null
  ),
  member_scores as (
    select
      pm.user_id,
      ukb.submitted_at,
      coalesce(sum(
        case when ukp.selected_team = ow.winner_team then ow.points else 0 end
      ), 0)::integer as total_points,
      coalesce(count(*) filter (
        where ukp.selected_team = ow.winner_team
      ), 0)::integer as correct_picks
    from public.pool_members pm
    left join public.user_knockout_brackets ukb
      on ukb.user_id = pm.user_id
      and ukb.tournament_key = target_tournament_key
    left join public.user_knockout_picks ukp
      on ukp.bracket_id = ukb.id
    left join official_winners ow
      on ow.round = ukp.round
      and ow.position = ukp.position
    where pm.pool_id = target_pool_id
    group by pm.user_id, ukb.submitted_at
  )
  select
    ms.user_id,
    p.name as profile_name,
    p.username,
    p.avatar_url,
    ms.total_points,
    ms.correct_picks,
    ms.submitted_at
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

revoke all on function public.knockout_round_order(text) from public;
revoke all on function public.knockout_expected_positions(text) from public;
revoke all on function public.get_knockout_state(text) from public;
revoke all on function public.save_knockout_bracket(text, jsonb) from public;
revoke all on function public.get_pool_knockout_ranking(uuid, text) from public;

grant execute on function public.get_knockout_state(text) to authenticated;
grant execute on function public.save_knockout_bracket(text, jsonb) to authenticated;
grant execute on function public.get_pool_knockout_ranking(uuid, text) to authenticated;

notify pgrst, 'reload schema';
