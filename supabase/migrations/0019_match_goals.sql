create table if not exists public.match_goals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  provider text not null,
  provider_event_id text null,
  minute integer null,
  team_name text null,
  team_id uuid null references public.teams(id),
  player_name text null,
  goal_type text null,
  is_penalty boolean not null default false,
  is_own_goal boolean not null default false,
  raw_event jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists match_goals_match_id_idx
on public.match_goals(match_id);

create unique index if not exists match_goals_unique_provider_event
on public.match_goals(match_id, provider, provider_event_id)
where provider_event_id is not null;

create unique index if not exists match_goals_unique_fallback
on public.match_goals(match_id, provider, minute, team_name, player_name)
where provider_event_id is null;

drop trigger if exists match_goals_touch_updated_at on public.match_goals;
create trigger match_goals_touch_updated_at
before update on public.match_goals
for each row execute function public.touch_updated_at();

alter table public.match_goals enable row level security;

drop policy if exists "Authenticated users can view match goals" on public.match_goals;
create policy "Authenticated users can view match goals"
on public.match_goals
for select
to authenticated
using (true);
