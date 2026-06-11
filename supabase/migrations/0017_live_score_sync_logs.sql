create table if not exists public.live_score_sync_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  status text not null check (status in ('success', 'skipped', 'error')),
  reason text,
  active_matches_count integer not null default 0,
  updated_matches_count integer not null default 0,
  requested_matchdays integer[] not null default '{}',
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists live_score_sync_logs_started_at_idx
on public.live_score_sync_logs(started_at desc);

alter table public.live_score_sync_logs enable row level security;

drop policy if exists "Pool owners can view live score sync logs" on public.live_score_sync_logs;

create policy "Pool owners can view live score sync logs"
on public.live_score_sync_logs for select
to authenticated
using (
  exists (
    select 1
    from public.pool_members pm
    where pm.user_id = auth.uid()
      and pm.role = 'owner'
  )
);
