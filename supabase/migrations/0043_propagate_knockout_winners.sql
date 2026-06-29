create or replace function public.knockout_next_round(round_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select case round_value
    when 'round_of_32' then 'round_of_16'
    when 'round_of_16' then 'quarterfinal'
    when 'quarterfinal' then 'semifinal'
    when 'semifinal' then 'final'
    else null
  end;
$$;

create or replace function public.propagate_knockout_result()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  next_round_value text;
  next_position integer;
  source_is_first_side boolean;
  winner_name text;
  winner_code text;
  winner_flag_url text;
  loser_name text;
  loser_code text;
  loser_flag_url text;
begin
  if new.winner_team is null then
    return new;
  end if;

  if new.winner_team = new.team_a then
    winner_name := new.team_a;
    winner_code := new.team_a_code;
    winner_flag_url := new.team_a_flag_url;
    loser_name := new.team_b;
    loser_code := new.team_b_code;
    loser_flag_url := new.team_b_flag_url;
  elsif new.winner_team = new.team_b then
    winner_name := new.team_b;
    winner_code := new.team_b_code;
    winner_flag_url := new.team_b_flag_url;
    loser_name := new.team_a;
    loser_code := new.team_a_code;
    loser_flag_url := new.team_a_flag_url;
  else
    winner_name := new.winner_team;
    winner_code := new.winner_team_code;
    winner_flag_url := null;
  end if;

  if nullif(trim(coalesce(winner_name, '')), '') is null then
    return new;
  end if;

  next_round_value := public.knockout_next_round(new.round);

  if next_round_value is not null then
    next_position := ((new.position + 1) / 2)::integer;
    source_is_first_side := new.position % 2 = 1;

    if source_is_first_side then
      update public.knockout_matches km
      set
        team_a_source = null,
        team_a = winner_name,
        team_a_code = winner_code,
        team_a_flag_url = winner_flag_url,
        winner_team = case
          when km.winner_team is not null
            and km.winner_team is distinct from winner_name
            and km.winner_team is distinct from km.team_b
          then null
          else km.winner_team
        end,
        winner_team_code = case
          when km.winner_team is not null
            and km.winner_team is distinct from winner_name
            and km.winner_team is distinct from km.team_b
          then null
          else km.winner_team_code
        end
      where km.tournament_key = new.tournament_key
        and km.round = next_round_value
        and km.position = next_position;
    else
      update public.knockout_matches km
      set
        team_b_source = null,
        team_b = winner_name,
        team_b_code = winner_code,
        team_b_flag_url = winner_flag_url,
        winner_team = case
          when km.winner_team is not null
            and km.winner_team is distinct from km.team_a
            and km.winner_team is distinct from winner_name
          then null
          else km.winner_team
        end,
        winner_team_code = case
          when km.winner_team is not null
            and km.winner_team is distinct from km.team_a
            and km.winner_team is distinct from winner_name
          then null
          else km.winner_team_code
        end
      where km.tournament_key = new.tournament_key
        and km.round = next_round_value
        and km.position = next_position;
    end if;
  end if;

  if new.round = 'semifinal'
    and nullif(trim(coalesce(loser_name, '')), '') is not null
  then
    if new.position = 1 then
      update public.knockout_matches km
      set
        team_a_source = null,
        team_a = loser_name,
        team_a_code = loser_code,
        team_a_flag_url = loser_flag_url
      where km.tournament_key = new.tournament_key
        and km.round = 'third_place'
        and km.position = 1;
    elsif new.position = 2 then
      update public.knockout_matches km
      set
        team_b_source = null,
        team_b = loser_name,
        team_b_code = loser_code,
        team_b_flag_url = loser_flag_url
      where km.tournament_key = new.tournament_key
        and km.round = 'third_place'
        and km.position = 1;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists knockout_matches_propagate_result
on public.knockout_matches;

create trigger knockout_matches_propagate_result
after insert or update of
  home_score,
  away_score,
  winner_team,
  winner_team_code,
  team_a,
  team_a_code,
  team_a_flag_url,
  team_b,
  team_b_code,
  team_b_flag_url
on public.knockout_matches
for each row
execute function public.propagate_knockout_result();

update public.knockout_matches
set winner_team = winner_team
where winner_team is not null;

revoke all on function public.knockout_next_round(text) from public;

notify pgrst, 'reload schema';
