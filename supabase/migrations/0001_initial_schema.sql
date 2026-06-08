create extension if not exists pgcrypto;

create table public.pools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pool_members (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (pool_id, user_id)
);

create table public.pool_invites (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  token text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  flag_url text,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.group_teams (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  position int check (position between 1 and 4),
  created_at timestamptz not null default now(),
  unique (group_id, team_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid not null references public.teams(id),
  round_number int not null check (round_number between 1 and 3),
  match_date timestamptz,
  home_score int check (home_score is null or home_score >= 0),
  away_score int check (away_score is null or away_score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  home_score int check (home_score is null or home_score >= 0),
  away_score int check (away_score is null or away_score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pool_id, user_id, match_id)
);

create index pool_members_user_id_idx on public.pool_members(user_id);
create index pool_members_pool_id_idx on public.pool_members(pool_id);
create index pool_invites_pool_id_idx on public.pool_invites(pool_id);
create index group_teams_group_id_idx on public.group_teams(group_id);
create index matches_group_id_idx on public.matches(group_id);
create index predictions_user_pool_idx on public.predictions(user_id, pool_id);
create index predictions_match_id_idx on public.predictions(match_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pools_touch_updated_at
before update on public.pools
for each row execute function public.touch_updated_at();

create trigger matches_touch_updated_at
before update on public.matches
for each row execute function public.touch_updated_at();

create trigger predictions_touch_updated_at
before update on public.predictions
for each row execute function public.touch_updated_at();

create or replace function public.is_pool_member(target_pool_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = target_pool_id
      and pm.user_id = auth.uid()
  );
$$;

create or replace function public.is_pool_owner(target_pool_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = target_pool_id
      and pm.user_id = auth.uid()
      and pm.role = 'owner'
  );
$$;

alter table public.pools enable row level security;
alter table public.pool_members enable row level security;
alter table public.pool_invites enable row level security;
alter table public.teams enable row level security;
alter table public.groups enable row level security;
alter table public.group_teams enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;

create policy "Members can view their pools"
on public.pools for select
to authenticated
using (public.is_pool_member(id));

create policy "Authenticated users can create owned pools"
on public.pools for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Owners can update pools"
on public.pools for update
to authenticated
using (public.is_pool_owner(id))
with check (public.is_pool_owner(id));

create policy "Members can view pool members"
on public.pool_members for select
to authenticated
using (public.is_pool_member(pool_id));

create policy "Owners can manage pool members"
on public.pool_members for all
to authenticated
using (public.is_pool_owner(pool_id))
with check (public.is_pool_owner(pool_id));

create policy "Owners can view invites"
on public.pool_invites for select
to authenticated
using (public.is_pool_owner(pool_id));

create policy "Owners can create invites"
on public.pool_invites for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_pool_owner(pool_id)
);

create policy "Owners can update invites"
on public.pool_invites for update
to authenticated
using (public.is_pool_owner(pool_id))
with check (public.is_pool_owner(pool_id));

create policy "Owners can delete invites"
on public.pool_invites for delete
to authenticated
using (public.is_pool_owner(pool_id));

create policy "Authenticated users can view teams"
on public.teams for select
to authenticated
using (true);

create policy "Authenticated users can view groups"
on public.groups for select
to authenticated
using (true);

create policy "Authenticated users can view group teams"
on public.group_teams for select
to authenticated
using (true);

create policy "Authenticated users can view matches"
on public.matches for select
to authenticated
using (true);

create policy "Users can view own predictions"
on public.predictions for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_pool_member(pool_id)
);

create policy "Users can create own predictions in member pools"
on public.predictions for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_pool_member(pool_id)
);

create policy "Users can update own predictions in member pools"
on public.predictions for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_pool_member(pool_id)
)
with check (
  user_id = auth.uid()
  and public.is_pool_member(pool_id)
);

create or replace function public.accept_pool_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record public.pool_invites%rowtype;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into invite_record
  from public.pool_invites
  where token = invite_token
  for update;

  if invite_record.id is null then
    raise exception 'Invalid invite';
  end if;

  if invite_record.used_at is not null then
    raise exception 'Invite already used';
  end if;

  if invite_record.expires_at is not null and invite_record.expires_at < now() then
    raise exception 'Invite expired';
  end if;

  insert into public.pool_members (pool_id, user_id, role)
  values (invite_record.pool_id, current_user_id, 'member')
  on conflict (pool_id, user_id) do nothing;

  update public.pool_invites
  set used_by = current_user_id,
      used_at = now()
  where id = invite_record.id;

  return invite_record.pool_id;
end;
$$;

revoke all on function public.accept_pool_invite(text) from public;
grant execute on function public.accept_pool_invite(text) to authenticated;
