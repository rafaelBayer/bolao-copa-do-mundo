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
    join public.predictions pr
      on pr.match_id = m.id
      and pr.pool_id = target_pool_id
      and pr.home_score = m.home_score
      and pr.away_score = m.away_score
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
