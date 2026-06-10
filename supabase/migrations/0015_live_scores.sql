alter table public.matches
add column if not exists api_football_fixture_id bigint,
add column if not exists status_short text,
add column if not exists status_long text,
add column if not exists elapsed integer,
add column if not exists home_score_live integer,
add column if not exists away_score_live integer,
add column if not exists score_updated_at timestamptz;

create index if not exists matches_api_football_fixture_id_idx
on public.matches(api_football_fixture_id)
where api_football_fixture_id is not null;
