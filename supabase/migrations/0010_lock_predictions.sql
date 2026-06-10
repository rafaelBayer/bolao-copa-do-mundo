create or replace function public.prevent_locked_prediction_changes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  match_kickoff_at timestamptz;
begin
  select m.kickoff_at
  into match_kickoff_at
  from public.matches m
  where m.id = new.match_id;

  if match_kickoff_at is not null and match_kickoff_at <= now() then
    raise exception 'Prediction locked because match already started';
  end if;

  return new;
end;
$$;

drop trigger if exists predictions_prevent_locked_changes on public.predictions;

create trigger predictions_prevent_locked_changes
before insert or update on public.predictions
for each row execute function public.prevent_locked_prediction_changes();

create or replace function public.save_prediction(
  target_pool_id uuid,
  target_match_id uuid,
  predicted_home_score int,
  predicted_away_score int
)
returns table (
  id uuid,
  pool_id uuid,
  user_id uuid,
  match_id uuid,
  home_score int,
  away_score int,
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

  if match_kickoff_at is not null and match_kickoff_at <= now() then
    raise exception 'Prediction locked because match already started';
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
  on conflict (pool_id, user_id, match_id) do update
  set
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

revoke all on function public.save_prediction(uuid, uuid, int, int) from public;
grant execute on function public.save_prediction(uuid, uuid, int, int) to authenticated;
