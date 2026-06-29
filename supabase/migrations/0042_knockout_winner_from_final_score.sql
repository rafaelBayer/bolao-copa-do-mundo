create or replace function public.set_knockout_winner_from_final_score()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.home_score is null or new.away_score is null then
    return new;
  end if;

  if new.home_score = new.away_score then
    return new;
  end if;

  if new.home_score > new.away_score then
    new.winner_team := new.team_a;
    new.winner_team_code := new.team_a_code;
  else
    new.winner_team := new.team_b;
    new.winner_team_code := new.team_b_code;
  end if;

  return new;
end;
$$;

drop trigger if exists knockout_matches_set_winner_from_final_score
on public.knockout_matches;

create trigger knockout_matches_set_winner_from_final_score
before insert or update of
  home_score,
  away_score,
  team_a,
  team_a_code,
  team_b,
  team_b_code
on public.knockout_matches
for each row
execute function public.set_knockout_winner_from_final_score();

update public.knockout_matches
set
  winner_team = case
    when home_score > away_score then team_a
    when away_score > home_score then team_b
    else winner_team
  end,
  winner_team_code = case
    when home_score > away_score then team_a_code
    when away_score > home_score then team_b_code
    else winner_team_code
  end
where winner_team is null
  and home_score is not null
  and away_score is not null
  and home_score <> away_score;

notify pgrst, 'reload schema';
