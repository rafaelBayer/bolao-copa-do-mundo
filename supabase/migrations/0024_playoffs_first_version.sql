create table if not exists public.playoff_settings (
  pool_id uuid primary key references public.pools(id) on delete cascade,
  is_enabled boolean not null default false,
  first_match_kickoff_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playoff_matches (
  id uuid primary key default gen_random_uuid(),
  stage text not null check (
    stage in (
      'ROUND_OF_32',
      'ROUND_OF_16',
      'QUARTER_FINAL',
      'SEMI_FINAL',
      'FINAL'
    )
  ),
  position integer not null,
  home_team_id uuid null references public.teams(id),
  away_team_id uuid null references public.teams(id),
  source_home text null,
  source_away text null,
  kickoff_at timestamptz null,
  next_match_id uuid null references public.playoff_matches(id),
  next_match_slot text null check (next_match_slot in ('home', 'away')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(stage, position)
);

create table if not exists public.playoff_picks (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  playoff_match_id uuid not null references public.playoff_matches(id) on delete cascade,
  selected_team_id uuid not null references public.teams(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pool_id, user_id, playoff_match_id)
);

create index if not exists playoff_picks_pool_user_idx
on public.playoff_picks(pool_id, user_id);

create index if not exists playoff_picks_match_idx
on public.playoff_picks(playoff_match_id);

drop trigger if exists playoff_settings_touch_updated_at on public.playoff_settings;
create trigger playoff_settings_touch_updated_at
before update on public.playoff_settings
for each row execute function public.touch_updated_at();

drop trigger if exists playoff_matches_touch_updated_at on public.playoff_matches;
create trigger playoff_matches_touch_updated_at
before update on public.playoff_matches
for each row execute function public.touch_updated_at();

drop trigger if exists playoff_picks_touch_updated_at on public.playoff_picks;
create trigger playoff_picks_touch_updated_at
before update on public.playoff_picks
for each row execute function public.touch_updated_at();

alter table public.playoff_settings enable row level security;
alter table public.playoff_matches enable row level security;
alter table public.playoff_picks enable row level security;

drop policy if exists "Pool members can view playoff settings" on public.playoff_settings;
create policy "Pool members can view playoff settings"
on public.playoff_settings
for select
to authenticated
using (public.is_pool_member(pool_id));

drop policy if exists "Authenticated users can view playoff matches" on public.playoff_matches;

drop policy if exists "Users can view own playoff picks" on public.playoff_picks;
create policy "Users can view own playoff picks"
on public.playoff_picks
for select
to authenticated
using (user_id = auth.uid() and public.is_pool_member(pool_id));

create or replace function public.playoff_stage_order(stage_value text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case stage_value
    when 'ROUND_OF_32' then 1
    when 'ROUND_OF_16' then 2
    when 'QUARTER_FINAL' then 3
    when 'SEMI_FINAL' then 4
    when 'FINAL' then 5
    else 99
  end;
$$;

create or replace function public.playoff_default_lock_at()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select coalesce(
    min(kickoff_at),
    '2026-06-28 16:00:00-03'::timestamptz
  )
  from public.playoff_matches;
$$;

create or replace function public.ensure_playoff_settings(target_pool_id uuid)
returns public.playoff_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  settings_record public.playoff_settings%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can view playoff settings';
  end if;

  insert into public.playoff_settings(pool_id, is_enabled, first_match_kickoff_at)
  values (target_pool_id, false, public.playoff_default_lock_at())
  on conflict (pool_id) do nothing;

  select *
  into settings_record
  from public.playoff_settings
  where pool_id = target_pool_id;

  return settings_record;
end;
$$;

create or replace function public.get_playoff_bracket(target_pool_id uuid)
returns table (
  is_owner boolean,
  is_enabled boolean,
  can_access boolean,
  is_locked boolean,
  lock_at timestamptz,
  started_users_count integer,
  matches jsonb,
  picks jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  owner_access boolean;
  settings_record public.playoff_settings%rowtype;
  resolved_lock_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can view playoffs';
  end if;

  owner_access := public.is_pool_owner(target_pool_id);
  settings_record := public.ensure_playoff_settings(target_pool_id);
  resolved_lock_at := coalesce(
    settings_record.first_match_kickoff_at,
    public.playoff_default_lock_at()
  );

  return query
  select
    owner_access as is_owner,
    settings_record.is_enabled as is_enabled,
    (owner_access or settings_record.is_enabled) as can_access,
    now() >= resolved_lock_at as is_locked,
    resolved_lock_at as lock_at,
    (
      select count(distinct pp.user_id)::integer
      from public.playoff_picks pp
      where pp.pool_id = target_pool_id
    ) as started_users_count,
    case
      when owner_access or settings_record.is_enabled then
        (
          select coalesce(jsonb_agg(match_payload order by stage_order, position), '[]'::jsonb)
          from (
            select
              public.playoff_stage_order(pm.stage) as stage_order,
              pm.position,
              jsonb_build_object(
                'id', pm.id,
                'stage', pm.stage,
                'position', pm.position,
                'homeTeamId', pm.home_team_id,
                'awayTeamId', pm.away_team_id,
                'sourceHome', pm.source_home,
                'sourceAway', pm.source_away,
                'kickoffAt', pm.kickoff_at,
                'nextMatchId', pm.next_match_id,
                'nextMatchSlot', pm.next_match_slot,
                'homeTeam', case
                  when ht.id is null then null
                  else jsonb_build_object(
                    'id', ht.id,
                    'name', ht.name,
                    'code', ht.code,
                    'flagUrl', ht.flag_url
                  )
                end,
                'awayTeam', case
                  when at.id is null then null
                  else jsonb_build_object(
                    'id', at.id,
                    'name', at.name,
                    'code', at.code,
                    'flagUrl', at.flag_url
                  )
                end
              ) as match_payload
            from public.playoff_matches pm
            left join public.teams ht on ht.id = pm.home_team_id
            left join public.teams at on at.id = pm.away_team_id
          ) payload
        )
      else '[]'::jsonb
    end as matches,
    case
      when owner_access or settings_record.is_enabled then
        (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', pp.id,
            'playoffMatchId', pp.playoff_match_id,
            'selectedTeamId', pp.selected_team_id,
            'createdAt', pp.created_at,
            'updatedAt', pp.updated_at
          ) order by pp.updated_at), '[]'::jsonb)
          from public.playoff_picks pp
          where pp.pool_id = target_pool_id
            and pp.user_id = current_user_id
        )
      else '[]'::jsonb
    end as picks;
end;
$$;

create or replace function public.playoff_allowed_team_ids(
  target_pool_id uuid,
  target_user_id uuid,
  target_match_id uuid
)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select array_remove(array[
    coalesce(
      target_match.home_team_id,
      (
        select source_pick.selected_team_id
        from public.playoff_matches source_match
        join public.playoff_picks source_pick
          on source_pick.playoff_match_id = source_match.id
          and source_pick.pool_id = target_pool_id
          and source_pick.user_id = target_user_id
        where source_match.next_match_id = target_match.id
          and source_match.next_match_slot = 'home'
        limit 1
      )
    ),
    coalesce(
      target_match.away_team_id,
      (
        select source_pick.selected_team_id
        from public.playoff_matches source_match
        join public.playoff_picks source_pick
          on source_pick.playoff_match_id = source_match.id
          and source_pick.pool_id = target_pool_id
          and source_pick.user_id = target_user_id
        where source_match.next_match_id = target_match.id
          and source_match.next_match_slot = 'away'
        limit 1
      )
    )
  ], null)
  from public.playoff_matches target_match
  where target_match.id = target_match_id;
$$;

create or replace function public.save_playoff_pick(
  target_pool_id uuid,
  target_playoff_match_id uuid,
  target_selected_team_id uuid
)
returns table (
  id uuid,
  pool_id uuid,
  user_id uuid,
  playoff_match_id uuid,
  selected_team_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  settings_record public.playoff_settings%rowtype;
  resolved_lock_at timestamptz;
  owner_access boolean;
  allowed_team_ids uuid[];
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can save playoff picks';
  end if;

  owner_access := public.is_pool_owner(target_pool_id);
  settings_record := public.ensure_playoff_settings(target_pool_id);
  resolved_lock_at := coalesce(
    settings_record.first_match_kickoff_at,
    public.playoff_default_lock_at()
  );

  if not owner_access and not settings_record.is_enabled then
    raise exception 'Playoffs are not enabled for participants yet';
  end if;

  if now() >= resolved_lock_at then
    raise exception 'Playoff picks are locked';
  end if;

  select public.playoff_allowed_team_ids(
    target_pool_id,
    current_user_id,
    target_playoff_match_id
  )
  into allowed_team_ids;

  if allowed_team_ids is null or array_length(allowed_team_ids, 1) < 2 then
    raise exception 'This playoff match is not ready for picks';
  end if;

  if target_selected_team_id <> all(allowed_team_ids) then
    raise exception 'Selected team does not belong to this playoff match';
  end if;

  insert into public.playoff_picks as target_pick (
    pool_id,
    user_id,
    playoff_match_id,
    selected_team_id
  )
  values (
    target_pool_id,
    current_user_id,
    target_playoff_match_id,
    target_selected_team_id
  )
  on conflict on constraint playoff_picks_pool_id_user_id_playoff_match_id_key
  do update set
    selected_team_id = excluded.selected_team_id,
    updated_at = now();

  with recursive downstream(match_id) as (
    select pm.next_match_id
    from public.playoff_matches pm
    where pm.id = target_playoff_match_id
      and pm.next_match_id is not null

    union

    select next_pm.next_match_id
    from public.playoff_matches next_pm
    join downstream d on d.match_id = next_pm.id
    where next_pm.next_match_id is not null
  )
  delete from public.playoff_picks pp
  using downstream d
  where pp.pool_id = target_pool_id
    and pp.user_id = current_user_id
    and pp.playoff_match_id = d.match_id;

  return query
  select
    pp.id,
    pp.pool_id,
    pp.user_id,
    pp.playoff_match_id,
    pp.selected_team_id,
    pp.created_at,
    pp.updated_at
  from public.playoff_picks pp
  where pp.pool_id = target_pool_id
    and pp.user_id = current_user_id
    and pp.playoff_match_id = target_playoff_match_id;
end;
$$;

create or replace function public.admin_set_playoffs_enabled(
  target_pool_id uuid,
  target_enabled boolean
)
returns table (
  pool_id uuid,
  is_enabled boolean,
  first_match_kickoff_at timestamptz,
  is_locked boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  settings_record public.playoff_settings%rowtype;
  resolved_lock_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_owner(target_pool_id) then
    raise exception 'Only pool owners can update playoff access';
  end if;

  settings_record := public.ensure_playoff_settings(target_pool_id);
  resolved_lock_at := coalesce(
    settings_record.first_match_kickoff_at,
    public.playoff_default_lock_at()
  );

  if now() >= resolved_lock_at then
    raise exception 'Playoffs are locked';
  end if;

  update public.playoff_settings ps
  set is_enabled = target_enabled
  where ps.pool_id = target_pool_id
  returning *
  into settings_record;

  return query
  select
    settings_record.pool_id,
    settings_record.is_enabled,
    settings_record.first_match_kickoff_at,
    now() >= resolved_lock_at,
    settings_record.updated_at;
end;
$$;

revoke all on function public.playoff_stage_order(text) from public;
revoke all on function public.playoff_default_lock_at() from public;
revoke all on function public.ensure_playoff_settings(uuid) from public;
revoke all on function public.get_playoff_bracket(uuid) from public;
revoke all on function public.playoff_allowed_team_ids(uuid, uuid, uuid) from public;
revoke all on function public.save_playoff_pick(uuid, uuid, uuid) from public;
revoke all on function public.admin_set_playoffs_enabled(uuid, boolean) from public;

grant execute on function public.get_playoff_bracket(uuid) to authenticated;
grant execute on function public.save_playoff_pick(uuid, uuid, uuid) to authenticated;
grant execute on function public.admin_set_playoffs_enabled(uuid, boolean) to authenticated;

insert into public.playoff_matches (
  id,
  stage,
  position,
  source_home,
  source_away,
  kickoff_at,
  next_match_id,
  next_match_slot
)
values
  ('10000000-0000-0000-0000-000000000001', 'ROUND_OF_32', 1, 'Classificado 1', 'Classificado 2', '2026-06-28 16:00:00-03', '10000000-0000-0000-0000-000000000017', 'home'),
  ('10000000-0000-0000-0000-000000000002', 'ROUND_OF_32', 2, 'Classificado 3', 'Classificado 4', null, '10000000-0000-0000-0000-000000000017', 'away'),
  ('10000000-0000-0000-0000-000000000003', 'ROUND_OF_32', 3, 'Classificado 5', 'Classificado 6', null, '10000000-0000-0000-0000-000000000018', 'home'),
  ('10000000-0000-0000-0000-000000000004', 'ROUND_OF_32', 4, 'Classificado 7', 'Classificado 8', null, '10000000-0000-0000-0000-000000000018', 'away'),
  ('10000000-0000-0000-0000-000000000005', 'ROUND_OF_32', 5, 'Classificado 9', 'Classificado 10', null, '10000000-0000-0000-0000-000000000019', 'home'),
  ('10000000-0000-0000-0000-000000000006', 'ROUND_OF_32', 6, 'Classificado 11', 'Classificado 12', null, '10000000-0000-0000-0000-000000000019', 'away'),
  ('10000000-0000-0000-0000-000000000007', 'ROUND_OF_32', 7, 'Classificado 13', 'Classificado 14', null, '10000000-0000-0000-0000-000000000020', 'home'),
  ('10000000-0000-0000-0000-000000000008', 'ROUND_OF_32', 8, 'Classificado 15', 'Classificado 16', null, '10000000-0000-0000-0000-000000000020', 'away'),
  ('10000000-0000-0000-0000-000000000009', 'ROUND_OF_32', 9, 'Classificado 17', 'Classificado 18', null, '10000000-0000-0000-0000-000000000021', 'home'),
  ('10000000-0000-0000-0000-000000000010', 'ROUND_OF_32', 10, 'Classificado 19', 'Classificado 20', null, '10000000-0000-0000-0000-000000000021', 'away'),
  ('10000000-0000-0000-0000-000000000011', 'ROUND_OF_32', 11, 'Classificado 21', 'Classificado 22', null, '10000000-0000-0000-0000-000000000022', 'home'),
  ('10000000-0000-0000-0000-000000000012', 'ROUND_OF_32', 12, 'Classificado 23', 'Classificado 24', null, '10000000-0000-0000-0000-000000000022', 'away'),
  ('10000000-0000-0000-0000-000000000013', 'ROUND_OF_32', 13, 'Classificado 25', 'Classificado 26', null, '10000000-0000-0000-0000-000000000023', 'home'),
  ('10000000-0000-0000-0000-000000000014', 'ROUND_OF_32', 14, 'Classificado 27', 'Classificado 28', null, '10000000-0000-0000-0000-000000000023', 'away'),
  ('10000000-0000-0000-0000-000000000015', 'ROUND_OF_32', 15, 'Classificado 29', 'Classificado 30', null, '10000000-0000-0000-0000-000000000024', 'home'),
  ('10000000-0000-0000-0000-000000000016', 'ROUND_OF_32', 16, 'Classificado 31', 'Classificado 32', null, '10000000-0000-0000-0000-000000000024', 'away'),
  ('10000000-0000-0000-0000-000000000017', 'ROUND_OF_16', 1, 'Vencedor 1', 'Vencedor 2', null, '10000000-0000-0000-0000-000000000025', 'home'),
  ('10000000-0000-0000-0000-000000000018', 'ROUND_OF_16', 2, 'Vencedor 3', 'Vencedor 4', null, '10000000-0000-0000-0000-000000000025', 'away'),
  ('10000000-0000-0000-0000-000000000019', 'ROUND_OF_16', 3, 'Vencedor 5', 'Vencedor 6', null, '10000000-0000-0000-0000-000000000026', 'home'),
  ('10000000-0000-0000-0000-000000000020', 'ROUND_OF_16', 4, 'Vencedor 7', 'Vencedor 8', null, '10000000-0000-0000-0000-000000000026', 'away'),
  ('10000000-0000-0000-0000-000000000021', 'ROUND_OF_16', 5, 'Vencedor 9', 'Vencedor 10', null, '10000000-0000-0000-0000-000000000027', 'home'),
  ('10000000-0000-0000-0000-000000000022', 'ROUND_OF_16', 6, 'Vencedor 11', 'Vencedor 12', null, '10000000-0000-0000-0000-000000000027', 'away'),
  ('10000000-0000-0000-0000-000000000023', 'ROUND_OF_16', 7, 'Vencedor 13', 'Vencedor 14', null, '10000000-0000-0000-0000-000000000028', 'home'),
  ('10000000-0000-0000-0000-000000000024', 'ROUND_OF_16', 8, 'Vencedor 15', 'Vencedor 16', null, '10000000-0000-0000-0000-000000000028', 'away'),
  ('10000000-0000-0000-0000-000000000025', 'QUARTER_FINAL', 1, 'Vencedor Oitavas 1', 'Vencedor Oitavas 2', null, '10000000-0000-0000-0000-000000000029', 'home'),
  ('10000000-0000-0000-0000-000000000026', 'QUARTER_FINAL', 2, 'Vencedor Oitavas 3', 'Vencedor Oitavas 4', null, '10000000-0000-0000-0000-000000000029', 'away'),
  ('10000000-0000-0000-0000-000000000027', 'QUARTER_FINAL', 3, 'Vencedor Oitavas 5', 'Vencedor Oitavas 6', null, '10000000-0000-0000-0000-000000000030', 'home'),
  ('10000000-0000-0000-0000-000000000028', 'QUARTER_FINAL', 4, 'Vencedor Oitavas 7', 'Vencedor Oitavas 8', null, '10000000-0000-0000-0000-000000000030', 'away'),
  ('10000000-0000-0000-0000-000000000029', 'SEMI_FINAL', 1, 'Vencedor Quartas 1', 'Vencedor Quartas 2', null, '10000000-0000-0000-0000-000000000031', 'home'),
  ('10000000-0000-0000-0000-000000000030', 'SEMI_FINAL', 2, 'Vencedor Quartas 3', 'Vencedor Quartas 4', null, '10000000-0000-0000-0000-000000000031', 'away'),
  ('10000000-0000-0000-0000-000000000031', 'FINAL', 1, 'Vencedor Semi 1', 'Vencedor Semi 2', null, null, null)
on conflict (id) do nothing;
