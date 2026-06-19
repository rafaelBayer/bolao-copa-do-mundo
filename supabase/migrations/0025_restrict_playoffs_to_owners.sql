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
    owner_access as can_access,
    now() >= resolved_lock_at as is_locked,
    resolved_lock_at as lock_at,
    (
      select count(distinct pp.user_id)::integer
      from public.playoff_picks pp
      where pp.pool_id = target_pool_id
    ) as started_users_count,
    case
      when owner_access then
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
      when owner_access then
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
  allowed_team_ids uuid[];
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can save playoff picks';
  end if;

  if not public.is_pool_owner(target_pool_id) then
    raise exception 'Only pool owners can save playoff picks';
  end if;

  settings_record := public.ensure_playoff_settings(target_pool_id);
  resolved_lock_at := coalesce(
    settings_record.first_match_kickoff_at,
    public.playoff_default_lock_at()
  );

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
