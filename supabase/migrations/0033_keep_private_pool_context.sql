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
  existing_pool_id uuid;
  default_pool_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select pm.pool_id
  into existing_pool_id
  from public.pool_members pm
  left join public.pools p on p.id = pm.pool_id
  where pm.user_id = current_user_id
  order by
    case when coalesce(p.is_default, false) then 1 else 0 end,
    pm.created_at,
    pm.pool_id
  limit 1;

  if existing_pool_id is not null then
    perform *
    from public.ensure_user_profile_for_pool(existing_pool_id, preferred_name);

    return existing_pool_id;
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
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if target_pool_id is null then
    raise exception 'Pool context is required';
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
  on conflict (user_id, match_id)
  do update set
    pool_id = excluded.pool_id,
    home_score = excluded.home_score,
    away_score = excluded.away_score,
    updated_at = now()
  returning
    target_prediction.id,
    target_prediction.pool_id,
    target_prediction.user_id,
    target_prediction.match_id,
    target_prediction.home_score,
    target_prediction.away_score,
    target_prediction.created_at,
    target_prediction.updated_at;
end;
$$;

create or replace function public.save_prediction(
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
  resolved_pool_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select pm.pool_id
  into resolved_pool_id
  from public.pool_members pm
  left join public.pools p on p.id = pm.pool_id
  where pm.user_id = current_user_id
  order by
    case when coalesce(p.is_default, false) then 1 else 0 end,
    pm.created_at,
    pm.pool_id
  limit 1;

  if resolved_pool_id is null then
    resolved_pool_id := public.ensure_default_pool_membership(null);
  end if;

  return query
  select *
  from public.save_prediction(
    resolved_pool_id,
    target_match_id,
    predicted_home_score,
    predicted_away_score
  );
end;
$$;

revoke all on function public.save_prediction(uuid, uuid, integer, integer) from public;
revoke all on function public.save_prediction(uuid, integer, integer) from public;
grant execute on function public.save_prediction(uuid, uuid, integer, integer) to authenticated;
grant execute on function public.save_prediction(uuid, integer, integer) to authenticated;

notify pgrst, 'reload schema';
