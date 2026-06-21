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
  default_pool_id uuid;
  match_kickoff_at timestamptz;
  existing_prediction_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  default_pool_id := public.ensure_default_pool_membership(null);

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
      target_prediction.pool_id,
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
    default_pool_id,
    current_user_id,
    target_match_id,
    predicted_home_score,
    predicted_away_score,
    now()
  )
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

revoke all on function public.save_prediction(uuid, integer, integer) from public;
grant execute on function public.save_prediction(uuid, integer, integer) to authenticated;
