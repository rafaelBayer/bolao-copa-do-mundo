alter table public.user_knockout_brackets
add column if not exists submitted_at timestamptz null,
add column if not exists completed_at timestamptz null,
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now();

alter table public.user_knockout_picks
add column if not exists selected_team text null,
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now();

notify pgrst, 'reload schema';
