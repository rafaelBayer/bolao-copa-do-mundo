alter table public.knockout_settings
add column if not exists name text not null default 'Copa do Mundo 2026',
add column if not exists deadline_at timestamptz not null default '2026-06-28 15:50:00-03',
add column if not exists is_active boolean not null default true,
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now();

alter table public.knockout_matches
add column if not exists external_match_id text null,
add column if not exists team_a_source text null,
add column if not exists team_a text null,
add column if not exists team_a_code text null,
add column if not exists team_a_flag_url text null,
add column if not exists team_b_source text null,
add column if not exists team_b text null,
add column if not exists team_b_code text null,
add column if not exists team_b_flag_url text null,
add column if not exists starts_at timestamptz null,
add column if not exists winner_team text null,
add column if not exists winner_team_code text null,
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now();

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.knockout_matches'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%round%'
  loop
    execute format(
      'alter table public.knockout_matches drop constraint if exists %I',
      constraint_record.conname
    );
  end loop;
end $$;

alter table public.knockout_matches
add constraint knockout_matches_round_check
check (
  round in (
    'round_of_32',
    'round_of_16',
    'quarterfinal',
    'semifinal',
    'final',
    'third_place'
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'knockout_matches_tournament_round_position_key'
      and conrelid = 'public.knockout_matches'::regclass
  ) then
    alter table public.knockout_matches
    add constraint knockout_matches_tournament_round_position_key
    unique (tournament_key, round, position);
  end if;
end $$;

create index if not exists knockout_matches_tournament_round_idx
on public.knockout_matches(tournament_key, round, position);

notify pgrst, 'reload schema';
