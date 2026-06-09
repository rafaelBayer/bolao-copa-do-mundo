alter table public.matches
add column if not exists fifa_match_number int,
add column if not exists stadium text,
add column if not exists city text,
add column if not exists country text,
add column if not exists kickoff_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'teams_code_key'
      and conrelid = 'public.teams'::regclass
  ) then
    alter table public.teams
    add constraint teams_code_key unique (code);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_fifa_match_number_key'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches
    add constraint matches_fifa_match_number_key unique (fifa_match_number);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_group_home_away_round_key'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches
    add constraint matches_group_home_away_round_key
    unique (group_id, home_team_id, away_team_id, round_number);
  end if;
end;
$$;
