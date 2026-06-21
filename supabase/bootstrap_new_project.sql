-- Bootstrap SQL para criar um Supabase novo do zero.
-- Gerado a partir das migrations atuais do projeto, em ordem.
-- Aplique este arquivo uma vez em um projeto Supabase vazio.
-- Nao mantenha este arquivo dentro de supabase/migrations para evitar reaplicacao junto das migrations historicas.


-- ============================================================
-- 0001_initial_schema.sql
-- ============================================================

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


-- ============================================================
-- 0002_world_cup_official_data.sql
-- ============================================================

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


-- ============================================================
-- 0004_profiles.sql
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can view own profile'
  ) then
    create policy "Users can view own profile"
    on public.profiles
    for select
    to authenticated
    using (id = auth.uid());
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can insert own profile'
  ) then
    create policy "Users can insert own profile"
    on public.profiles
    for insert
    to authenticated
    with check (id = auth.uid());
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can update own profile'
  ) then
    create policy "Users can update own profile"
    on public.profiles
    for update
    to authenticated
    using (id = auth.uid())
    with check (id = auth.uid());
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'profiles_touch_updated_at'
  ) then
    create trigger profiles_touch_updated_at
    before update on public.profiles
    for each row execute function public.touch_updated_at();
  end if;
end;
$$;


-- ============================================================
-- 0005_avatar_storage.sql
-- ============================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can view avatars'
  ) then
    create policy "Authenticated users can view avatars"
    on storage.objects
    for select
    to authenticated
    using (bucket_id = 'avatars');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can upload own avatars'
  ) then
    create policy "Users can upload own avatars"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'avatars'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can update own avatars'
  ) then
    create policy "Users can update own avatars"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'avatars'
      and auth.uid()::text = (storage.foldername(name))[1]
    )
    with check (
      bucket_id = 'avatars'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can delete own avatars'
  ) then
    create policy "Users can delete own avatars"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'avatars'
      and auth.uid()::text = (storage.foldername(name))[1]
    );
  end if;
end;
$$;


-- ============================================================
-- 0006_admin_participants_and_invites.sql
-- ============================================================

create or replace function public.get_pool_participants(target_pool_id uuid)
returns table (
  user_id uuid,
  role text,
  created_at timestamptz,
  name text,
  avatar_url text,
  email text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_pool_owner(target_pool_id) then
    raise exception 'Only pool owners can view participant details';
  end if;

  return query
  select
    pm.user_id,
    pm.role,
    pm.created_at,
    p.name,
    p.avatar_url,
    au.email::text
  from public.pool_members pm
  left join public.profiles p on p.id = pm.user_id
  left join auth.users au on au.id = pm.user_id
  where pm.pool_id = target_pool_id
  order by pm.created_at asc;
end;
$$;

revoke all on function public.get_pool_participants(uuid) from public;
grant execute on function public.get_pool_participants(uuid) to authenticated;


-- ============================================================
-- 0007_reusable_invites.sql
-- ============================================================

create table if not exists public.pool_invite_uses (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.pool_invites(id) on delete cascade,
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  browser_fingerprint text,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create unique index if not exists pool_invite_uses_invite_user_unique
on public.pool_invite_uses(invite_id, user_id);

create unique index if not exists pool_invite_uses_invite_browser_unique
on public.pool_invite_uses(invite_id, browser_fingerprint)
where browser_fingerprint is not null;

create index if not exists pool_invite_uses_invite_id_idx
on public.pool_invite_uses(invite_id);

create index if not exists pool_invite_uses_pool_id_idx
on public.pool_invite_uses(pool_id);

create index if not exists pool_invite_uses_invite_ip_hash_idx
on public.pool_invite_uses(invite_id, ip_hash)
where ip_hash is not null;

alter table public.pool_invite_uses enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pool_invite_uses'
      and policyname = 'Owners can view pool invite uses'
  ) then
    create policy "Owners can view pool invite uses"
    on public.pool_invite_uses
    for select
    to authenticated
    using (public.is_pool_owner(pool_id));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pool_invite_uses'
      and policyname = 'Users can view own invite uses'
  ) then
    create policy "Users can view own invite uses"
    on public.pool_invite_uses
    for select
    to authenticated
    using (user_id = auth.uid());
  end if;
end;
$$;

drop function if exists public.accept_pool_invite(text);

create or replace function public.accept_pool_invite(
  invite_token text,
  browser_fingerprint text default null,
  ip_hash text default null,
  user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record public.pool_invites%rowtype;
  current_user_id uuid := auth.uid();
  normalized_browser_fingerprint text := nullif(trim(browser_fingerprint), '');
  normalized_ip_hash text := nullif(trim(ip_hash), '');
  normalized_user_agent text := nullif(trim(user_agent), '');
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into invite_record
  from public.pool_invites pi
  where pi.token = invite_token;

  if invite_record.id is null then
    raise exception 'Invalid invite';
  end if;

  if invite_record.expires_at is not null and invite_record.expires_at < now() then
    raise exception 'Invite expired';
  end if;

  if exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = invite_record.pool_id
      and pm.user_id = current_user_id
  ) then
    return invite_record.pool_id;
  end if;

  if exists (
    select 1
    from public.pool_invite_uses piu
    where piu.invite_id = invite_record.id
      and piu.user_id = current_user_id
  ) then
    raise exception 'This user already used this invite';
  end if;

  if normalized_browser_fingerprint is not null
    and exists (
      select 1
      from public.pool_invite_uses piu
      where piu.invite_id = invite_record.id
        and piu.browser_fingerprint = normalized_browser_fingerprint
    )
  then
    raise exception 'This browser already used this invite';
  end if;

  insert into public.pool_members (pool_id, user_id, role)
  values (invite_record.pool_id, current_user_id, 'member')
  on conflict (pool_id, user_id) do nothing;

  insert into public.pool_invite_uses (
    invite_id,
    pool_id,
    user_id,
    browser_fingerprint,
    ip_hash,
    user_agent
  )
  values (
    invite_record.id,
    invite_record.pool_id,
    current_user_id,
    normalized_browser_fingerprint,
    normalized_ip_hash,
    normalized_user_agent
  );

  return invite_record.pool_id;
end;
$$;

revoke all on function public.accept_pool_invite(text, text, text, text) from public;
grant execute on function public.accept_pool_invite(text, text, text, text) to authenticated;


-- ============================================================
-- 0008_leaderboard_rpc.sql
-- ============================================================

create or replace function public.get_pool_leaderboard_data(target_pool_id uuid)
returns table (
  user_id uuid,
  profile_name text,
  avatar_url text,
  match_id uuid,
  round_number int,
  predicted_home_score int,
  predicted_away_score int,
  actual_home_score int,
  actual_away_score int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can view leaderboard data';
  end if;

  return query
  select
    pm.user_id,
    p.name as profile_name,
    p.avatar_url,
    m.id as match_id,
    m.round_number,
    pr.home_score as predicted_home_score,
    pr.away_score as predicted_away_score,
    m.home_score as actual_home_score,
    m.away_score as actual_away_score
  from public.pool_members pm
  cross join public.matches m
  left join public.profiles p on p.id = pm.user_id
  left join public.predictions pr
    on pr.pool_id = pm.pool_id
    and pr.user_id = pm.user_id
    and pr.match_id = m.id
  where pm.pool_id = target_pool_id
  order by
    lower(coalesce(p.name, '')),
    pm.user_id,
    m.round_number,
    m.created_at;
end;
$$;

revoke all on function public.get_pool_leaderboard_data(uuid) from public;
grant execute on function public.get_pool_leaderboard_data(uuid) to authenticated;


-- ============================================================
-- 0009_ensure_user_profile.sql
-- ============================================================

create or replace function public.ensure_user_profile_for_pool(
  target_pool_id uuid,
  preferred_name text default null
)
returns table (
  id uuid,
  name text,
  avatar_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_profile public.profiles%rowtype;
  resolved_name text := nullif(trim(preferred_name), '');
  candidate_name text;
  candidate_number int := 1;
  returned_id uuid;
  returned_name text;
  returned_avatar_url text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can ensure profile';
  end if;

  select *
  into existing_profile
  from public.profiles p
  where p.id = current_user_id;

  if existing_profile.id is not null
    and nullif(trim(existing_profile.name), '') is not null
  then
    return query
    select
      existing_profile.id,
      existing_profile.name,
      existing_profile.avatar_url;
    return;
  end if;

  if resolved_name is null then
    perform pg_advisory_xact_lock(hashtext(target_pool_id::text));

    loop
      candidate_name := 'Visitante ' || candidate_number;

      exit when not exists (
        select 1
        from public.pool_members pm
        join public.profiles p on p.id = pm.user_id
        where pm.pool_id = target_pool_id
          and lower(trim(p.name)) = lower(candidate_name)
      );

      candidate_number := candidate_number + 1;
    end loop;

    resolved_name := candidate_name;
  end if;

  insert into public.profiles as target_profile (id, name, avatar_url)
  values (current_user_id, resolved_name, null)
  on conflict on constraint profiles_pkey do update
  set
    name = case
      when nullif(trim(target_profile.name), '') is null
        then excluded.name
      else target_profile.name
    end,
    updated_at = now()
  returning
    target_profile.id,
    target_profile.name,
    target_profile.avatar_url
  into
    returned_id,
    returned_name,
    returned_avatar_url;

  return query
  select
    returned_id,
    returned_name,
    returned_avatar_url;
end;
$$;

revoke all on function public.ensure_user_profile_for_pool(uuid, text) from public;
grant execute on function public.ensure_user_profile_for_pool(uuid, text) to authenticated;


-- ============================================================
-- 0010_lock_predictions.sql
-- ============================================================

create or replace function public.prevent_locked_prediction_changes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  match_kickoff_at timestamptz;
begin
  select m.kickoff_at
  into match_kickoff_at
  from public.matches m
  where m.id = new.match_id;

  if match_kickoff_at is not null and match_kickoff_at <= now() then
    raise exception 'Prediction locked because match already started';
  end if;

  return new;
end;
$$;

drop trigger if exists predictions_prevent_locked_changes on public.predictions;

create trigger predictions_prevent_locked_changes
before insert or update on public.predictions
for each row execute function public.prevent_locked_prediction_changes();

create or replace function public.save_prediction(
  target_pool_id uuid,
  target_match_id uuid,
  predicted_home_score int,
  predicted_away_score int
)
returns table (
  id uuid,
  pool_id uuid,
  user_id uuid,
  match_id uuid,
  home_score int,
  away_score int,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  match_kickoff_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can save predictions';
  end if;

  select m.kickoff_at
  into match_kickoff_at
  from public.matches m
  where m.id = target_match_id;

  if not found then
    raise exception 'Match not found';
  end if;

  if match_kickoff_at is not null and match_kickoff_at <= now() then
    raise exception 'Prediction locked because match already started';
  end if;

  return query
  insert into public.predictions as target_prediction (
    pool_id,
    user_id,
    match_id,
    home_score,
    away_score,
    updated_at
  )
  values (
    target_pool_id,
    current_user_id,
    target_match_id,
    predicted_home_score,
    predicted_away_score,
    now()
  )
  on conflict on constraint predictions_pool_id_user_id_match_id_key
  do update
  set
    home_score = excluded.home_score,
    away_score = excluded.away_score,
    updated_at = now()
  returning
    target_prediction.id,
    target_prediction.pool_id,
    target_prediction.user_id,
    target_prediction.match_id,
    target_prediction.home_score,
    target_prediction.away_score,
    target_prediction.created_at,
    target_prediction.updated_at;
end;
$$;

revoke all on function public.save_prediction(uuid, uuid, int, int) from public;
grant execute on function public.save_prediction(uuid, uuid, int, int) to authenticated;


-- ============================================================
-- 0011_profile_username.sql
-- ============================================================

alter table public.profiles
add column if not exists username text;

create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;

create unique index if not exists profiles_username_unique
on public.profiles (lower(username))
where username is not null;

create or replace function public.slugify_username(input_value text)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              lower(extensions.unaccent(trim(coalesce(input_value, '')))),
              '[^a-z0-9\s-]',
              '',
              'g'
            ),
            '\s+',
            '-',
            'g'
          ),
          '-+',
          '-',
          'g'
        ),
        '(^-+|-+$)',
        '',
        'g'
      ),
      ''
    ),
    'visitante'
  );
$$;

create or replace function public.next_available_username(base_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_base text := public.slugify_username(base_username);
  candidate text := normalized_base;
  candidate_number int := 2;
begin
  loop
    exit when not exists (
      select 1
      from public.profiles p
      where lower(p.username) = lower(candidate)
    );

    candidate := normalized_base || '-' || candidate_number;
    candidate_number := candidate_number + 1;
  end loop;

  return candidate;
end;
$$;

revoke all on function public.next_available_username(text) from public;

drop function if exists public.ensure_user_profile_for_pool(uuid, text);

create or replace function public.ensure_user_profile_for_pool(
  target_pool_id uuid,
  preferred_name text default null
)
returns table (
  id uuid,
  name text,
  username text,
  avatar_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_profile public.profiles%rowtype;
  resolved_name text := nullif(trim(preferred_name), '');
  resolved_username text;
  candidate_name text;
  candidate_number int := 1;
  returned_id uuid;
  returned_name text;
  returned_username text;
  returned_avatar_url text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can ensure profile';
  end if;

  perform pg_advisory_xact_lock(hashtext('profile-username'));

  select *
  into existing_profile
  from public.profiles p
  where p.id = current_user_id;

  if existing_profile.id is not null
    and nullif(trim(existing_profile.name), '') is not null
    and nullif(trim(existing_profile.username), '') is not null
  then
    return query
    select
      existing_profile.id,
      existing_profile.name,
      existing_profile.username,
      existing_profile.avatar_url;
    return;
  end if;

  if resolved_name is null then
    loop
      candidate_name := 'Visitante ' || candidate_number;

      exit when not exists (
        select 1
        from public.pool_members pm
        join public.profiles p on p.id = pm.user_id
        where pm.pool_id = target_pool_id
          and lower(trim(p.name)) = lower(candidate_name)
      );

      candidate_number := candidate_number + 1;
    end loop;

    resolved_name := candidate_name;
  end if;

  if existing_profile.id is not null
    and nullif(trim(existing_profile.name), '') is not null
  then
    resolved_name := existing_profile.name;
  end if;

  if existing_profile.id is not null
    and nullif(trim(existing_profile.username), '') is not null
  then
    resolved_username := existing_profile.username;
  else
    resolved_username := public.next_available_username(resolved_name);
  end if;

  insert into public.profiles as target_profile (id, name, username, avatar_url)
  values (current_user_id, resolved_name, resolved_username, null)
  on conflict on constraint profiles_pkey do update
  set
    name = case
      when nullif(trim(target_profile.name), '') is null
        then excluded.name
      else target_profile.name
    end,
    username = case
      when nullif(trim(target_profile.username), '') is null
        then excluded.username
      else target_profile.username
    end,
    updated_at = now()
  returning
    target_profile.id,
    target_profile.name,
    target_profile.username,
    target_profile.avatar_url
  into
    returned_id,
    returned_name,
    returned_username,
    returned_avatar_url;

  return query
  select
    returned_id,
    returned_name,
    returned_username,
    returned_avatar_url;
end;
$$;

drop function if exists public.get_pool_leaderboard_data(uuid);

create function public.get_pool_leaderboard_data(target_pool_id uuid)
returns table (
  user_id uuid,
  profile_name text,
  username text,
  avatar_url text,
  match_id uuid,
  round_number int,
  predicted_home_score int,
  predicted_away_score int,
  actual_home_score int,
  actual_away_score int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can view leaderboard data';
  end if;

  return query
  select
    pm.user_id,
    p.name as profile_name,
    p.username,
    p.avatar_url,
    m.id as match_id,
    m.round_number,
    pr.home_score as predicted_home_score,
    pr.away_score as predicted_away_score,
    m.home_score as actual_home_score,
    m.away_score as actual_away_score
  from public.pool_members pm
  cross join public.matches m
  left join public.profiles p on p.id = pm.user_id
  left join public.predictions pr
    on pr.pool_id = pm.pool_id
    and pr.user_id = pm.user_id
    and pr.match_id = m.id
  where pm.pool_id = target_pool_id
  order by
    lower(coalesce(p.name, '')),
    pm.user_id,
    m.round_number,
    m.created_at;
end;
$$;

revoke all on function public.ensure_user_profile_for_pool(uuid, text) from public;
grant execute on function public.ensure_user_profile_for_pool(uuid, text) to authenticated;

revoke all on function public.get_pool_leaderboard_data(uuid) from public;
grant execute on function public.get_pool_leaderboard_data(uuid) to authenticated;


-- ============================================================
-- 0012_visible_user_predictions.sql
-- ============================================================

drop function if exists public.get_visible_user_predictions_by_username(uuid, text);

create or replace function public.get_visible_user_predictions_by_username(
  p_target_pool_id uuid,
  p_target_username text
)
returns table (
  target_user_id uuid,
  target_name text,
  target_username text,
  target_avatar_url text,
  is_current_user boolean,
  blocked_predictions_count int,
  prediction_id uuid,
  match_id uuid,
  group_id uuid,
  group_name text,
  round_number int,
  kickoff_at timestamptz,
  home_team_name text,
  home_team_code text,
  away_team_name text,
  away_team_code text,
  predicted_home_score int,
  predicted_away_score int,
  actual_home_score int,
  actual_away_score int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_profile public.profiles%rowtype;
  is_self boolean;
  blocked_count int := 0;
  visible_count int := 0;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(p_target_pool_id) then
    raise exception 'Only pool members can view public profiles';
  end if;

  select *
  into target_profile
  from public.profiles p
  where lower(p.username) = lower(public.slugify_username(p_target_username));

  if target_profile.id is null then
    raise exception 'Profile not found';
  end if;

  if not exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = p_target_pool_id
      and pm.user_id = target_profile.id
  ) then
    raise exception 'Profile not found in this pool';
  end if;

  is_self := target_profile.id = current_user_id;

  if not is_self then
    select count(*)::int
    into blocked_count
    from public.predictions pr
    join public.matches m on m.id = pr.match_id
    where pr.pool_id = p_target_pool_id
      and pr.user_id = target_profile.id
      and pr.home_score is not null
      and pr.away_score is not null
      and (m.kickoff_at is null or m.kickoff_at > now());
  end if;

  select count(*)::int
  into visible_count
  from public.predictions pr
  join public.matches m on m.id = pr.match_id
  where pr.pool_id = p_target_pool_id
    and pr.user_id = target_profile.id
    and pr.home_score is not null
    and pr.away_score is not null
    and (
      is_self
      or (m.kickoff_at is not null and m.kickoff_at <= now())
    );

  if visible_count = 0 then
    return query
    select
      target_profile.id,
      target_profile.name,
      target_profile.username,
      target_profile.avatar_url,
      is_self,
      blocked_count,
      null::uuid,
      null::uuid,
      null::uuid,
      null::text,
      null::int,
      null::timestamptz,
      null::text,
      null::text,
      null::text,
      null::text,
      null::int,
      null::int,
      null::int,
      null::int;
    return;
  end if;

  return query
  select
    target_profile.id,
    target_profile.name,
    target_profile.username,
    target_profile.avatar_url,
    is_self,
    blocked_count,
    pr.id as prediction_id,
    m.id as match_id,
    g.id as group_id,
    g.name as group_name,
    m.round_number,
    m.kickoff_at,
    home_team.name as home_team_name,
    home_team.code as home_team_code,
    away_team.name as away_team_name,
    away_team.code as away_team_code,
    pr.home_score as predicted_home_score,
    pr.away_score as predicted_away_score,
    m.home_score as actual_home_score,
    m.away_score as actual_away_score
  from public.predictions pr
  join public.matches m on m.id = pr.match_id
  join public.groups g on g.id = m.group_id
  join public.teams home_team on home_team.id = m.home_team_id
  join public.teams away_team on away_team.id = m.away_team_id
  where pr.pool_id = p_target_pool_id
    and pr.user_id = target_profile.id
    and pr.home_score is not null
    and pr.away_score is not null
    and (
      is_self
      or (m.kickoff_at is not null and m.kickoff_at <= now())
    )
  order by
    g.name,
    m.round_number,
    m.kickoff_at nulls last,
    m.created_at;
end;
$$;

revoke all on function public.get_visible_user_predictions_by_username(uuid, text) from public;
grant execute on function public.get_visible_user_predictions_by_username(uuid, text) to authenticated;


-- ============================================================
-- 0013_fix_save_prediction_conflict.sql
-- ============================================================

create or replace function public.save_prediction(
  target_pool_id uuid,
  target_match_id uuid,
  predicted_home_score integer,
  predicted_away_score integer
)
returns table (
  id uuid,
  pool_id uuid,
  user_id uuid,
  match_id uuid,
  home_score integer,
  away_score integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  match_kickoff_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can save predictions';
  end if;

  select m.kickoff_at
  into match_kickoff_at
  from public.matches m
  where m.id = target_match_id;

  if not found then
    raise exception 'Match not found';
  end if;

  if match_kickoff_at is not null and match_kickoff_at <= now() then
    raise exception 'Prediction locked because match already started';
  end if;

  return query
  insert into public.predictions as target_prediction (
    pool_id,
    user_id,
    match_id,
    home_score,
    away_score,
    updated_at
  )
  values (
    target_pool_id,
    current_user_id,
    target_match_id,
    predicted_home_score,
    predicted_away_score,
    now()
  )
  on conflict on constraint predictions_pool_id_user_id_match_id_key
  do update
  set
    home_score = excluded.home_score,
    away_score = excluded.away_score,
    updated_at = now()
  returning
    target_prediction.id,
    target_prediction.pool_id,
    target_prediction.user_id,
    target_prediction.match_id,
    target_prediction.home_score,
    target_prediction.away_score,
    target_prediction.created_at,
    target_prediction.updated_at;
end;
$$;

revoke all on function public.save_prediction(uuid, uuid, integer, integer) from public;
grant execute on function public.save_prediction(uuid, uuid, integer, integer) to authenticated;


-- ============================================================
-- 0014_pool_branding.sql
-- ============================================================

alter table public.pools
add column if not exists header_title text,
add column if not exists logo_url text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'pool-logos',
  'pool-logos',
  true,
  2097152,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_manage_pool_logo(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  folder_name text;
begin
  folder_name := (storage.foldername(object_name))[1];

  if folder_name is null then
    return false;
  end if;

  begin
    return public.is_pool_owner(folder_name::uuid);
  exception
    when invalid_text_representation then
      return false;
  end;
end;
$$;

revoke all on function public.can_manage_pool_logo(text) from public;
grant execute on function public.can_manage_pool_logo(text) to authenticated;

drop policy if exists "Authenticated users can view pool logos" on storage.objects;
drop policy if exists "Pool owners can upload pool logos" on storage.objects;
drop policy if exists "Pool owners can update pool logos" on storage.objects;
drop policy if exists "Pool owners can delete pool logos" on storage.objects;

create policy "Authenticated users can view pool logos"
on storage.objects for select
to authenticated
using (bucket_id = 'pool-logos');

create policy "Pool owners can upload pool logos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'pool-logos'
  and public.can_manage_pool_logo(name)
);

create policy "Pool owners can update pool logos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'pool-logos'
  and public.can_manage_pool_logo(name)
)
with check (
  bucket_id = 'pool-logos'
  and public.can_manage_pool_logo(name)
);

create policy "Pool owners can delete pool logos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'pool-logos'
  and public.can_manage_pool_logo(name)
);


-- ============================================================
-- 0015_live_scores.sql
-- ============================================================

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


-- ============================================================
-- 0016_live_score_provider_and_admin.sql
-- ============================================================

alter table public.matches
add column if not exists score_provider text,
add column if not exists score_provider_fixture_id text;

create index if not exists matches_score_provider_fixture_idx
on public.matches(score_provider, score_provider_fixture_id)
where score_provider_fixture_id is not null;

create or replace function public.admin_update_match_live_score(
  target_pool_id uuid,
  target_match_id uuid,
  target_home_score_live integer,
  target_away_score_live integer,
  target_status_short text default '1H',
  target_elapsed integer default null
)
returns table (
  id uuid,
  home_score_live integer,
  away_score_live integer,
  status_short text,
  status_long text,
  elapsed integer,
  score_updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_status text := upper(nullif(trim(target_status_short), ''));
  resolved_status_long text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_owner(target_pool_id) then
    raise exception 'Only pool owners can update live scores';
  end if;

  if target_home_score_live is null or target_home_score_live < 0 then
    raise exception 'Invalid home live score';
  end if;

  if target_away_score_live is null or target_away_score_live < 0 then
    raise exception 'Invalid away live score';
  end if;

  if target_elapsed is not null and target_elapsed < 0 then
    raise exception 'Invalid elapsed minute';
  end if;

  normalized_status := coalesce(normalized_status, '1H');
  resolved_status_long := case normalized_status
    when '1H' then 'First Half'
    when '2H' then 'Second Half'
    when 'HT' then 'Halftime'
    when 'FT' then 'Match Finished'
    else normalized_status
  end;

  return query
  update public.matches as target_match
  set
    home_score_live = target_home_score_live,
    away_score_live = target_away_score_live,
    status_short = normalized_status,
    status_long = resolved_status_long,
    elapsed = target_elapsed,
    score_updated_at = now()
  where target_match.id = target_match_id
  returning
    target_match.id,
    target_match.home_score_live,
    target_match.away_score_live,
    target_match.status_short,
    target_match.status_long,
    target_match.elapsed,
    target_match.score_updated_at;
end;
$$;

create or replace function public.admin_finalize_match_score(
  target_pool_id uuid,
  target_match_id uuid,
  target_home_score integer,
  target_away_score integer
)
returns table (
  id uuid,
  home_score integer,
  away_score integer,
  status_short text,
  status_long text,
  score_updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_owner(target_pool_id) then
    raise exception 'Only pool owners can finalize scores';
  end if;

  if target_home_score is null or target_home_score < 0 then
    raise exception 'Invalid home score';
  end if;

  if target_away_score is null or target_away_score < 0 then
    raise exception 'Invalid away score';
  end if;

  return query
  update public.matches as target_match
  set
    home_score = target_home_score,
    away_score = target_away_score,
    home_score_live = target_home_score,
    away_score_live = target_away_score,
    status_short = 'FT',
    status_long = 'Match Finished',
    elapsed = 90,
    score_updated_at = now()
  where target_match.id = target_match_id
  returning
    target_match.id,
    target_match.home_score,
    target_match.away_score,
    target_match.status_short,
    target_match.status_long,
    target_match.score_updated_at;
end;
$$;

revoke all on function public.admin_update_match_live_score(uuid, uuid, integer, integer, text, integer) from public;
revoke all on function public.admin_finalize_match_score(uuid, uuid, integer, integer) from public;

grant execute on function public.admin_update_match_live_score(uuid, uuid, integer, integer, text, integer) to authenticated;
grant execute on function public.admin_finalize_match_score(uuid, uuid, integer, integer) to authenticated;


-- ============================================================
-- 0017_live_score_sync_logs.sql
-- ============================================================

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


-- ============================================================
-- 0018_pool_branding_rpc.sql
-- ============================================================

create or replace function public.update_pool_branding(
  target_pool_id uuid,
  target_header_title text default null,
  target_logo_url text default null
)
returns table (
  header_title text,
  logo_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_owner(target_pool_id) then
    raise exception 'Only pool owners can update branding';
  end if;

  return query
  update public.pools as target_pool
  set
    header_title = nullif(trim(target_header_title), ''),
    logo_url = nullif(trim(target_logo_url), ''),
    updated_at = now()
  where target_pool.id = target_pool_id
  returning
    target_pool.header_title,
    target_pool.logo_url;
end;
$$;

revoke all on function public.update_pool_branding(uuid, text, text) from public;
grant execute on function public.update_pool_branding(uuid, text, text) to authenticated;


-- ============================================================
-- 0019_match_goals.sql
-- ============================================================

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


-- ============================================================
-- 0020_lock_predictions_one_hour_before.sql
-- ============================================================

create or replace function public.prevent_locked_prediction_changes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  match_kickoff_at timestamptz;
begin
  select m.kickoff_at
  into match_kickoff_at
  from public.matches m
  where m.id = new.match_id;

  if match_kickoff_at is not null and now() >= match_kickoff_at - interval '1 hour' then
    raise exception 'Prediction locked because match starts within one hour';
  end if;

  return new;
end;
$$;

create or replace function public.save_prediction(
  target_pool_id uuid,
  target_match_id uuid,
  predicted_home_score integer,
  predicted_away_score integer
)
returns table (
  id uuid,
  pool_id uuid,
  user_id uuid,
  match_id uuid,
  home_score integer,
  away_score integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  match_kickoff_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can save predictions';
  end if;

  select m.kickoff_at
  into match_kickoff_at
  from public.matches m
  where m.id = target_match_id;

  if not found then
    raise exception 'Match not found';
  end if;

  if match_kickoff_at is not null and now() >= match_kickoff_at - interval '1 hour' then
    raise exception 'Prediction locked because match starts within one hour';
  end if;

  return query
  insert into public.predictions as target_prediction (
    pool_id,
    user_id,
    match_id,
    home_score,
    away_score,
    updated_at
  )
  values (
    target_pool_id,
    current_user_id,
    target_match_id,
    predicted_home_score,
    predicted_away_score,
    now()
  )
  on conflict on constraint predictions_pool_id_user_id_match_id_key
  do update
  set
    home_score = excluded.home_score,
    away_score = excluded.away_score,
    updated_at = now()
  returning
    target_prediction.id,
    target_prediction.pool_id,
    target_prediction.user_id,
    target_prediction.match_id,
    target_prediction.home_score,
    target_prediction.away_score,
    target_prediction.created_at,
    target_prediction.updated_at;
end;
$$;

revoke all on function public.save_prediction(uuid, uuid, integer, integer) from public;
grant execute on function public.save_prediction(uuid, uuid, integer, integer) to authenticated;


-- ============================================================
-- 0021_match_predictions_after_lock.sql
-- ============================================================

drop function if exists public.get_match_predictions_after_lock(uuid, uuid);

create or replace function public.get_match_predictions_after_lock(
  target_pool_id uuid,
  target_match_id uuid
)
returns table (
  user_id uuid,
  participant_name text,
  participant_avatar_url text,
  is_current_user boolean,
  home_score integer,
  away_score integer,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  match_kickoff_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can view match predictions';
  end if;

  select m.kickoff_at
  into match_kickoff_at
  from public.matches m
  where m.id = target_match_id;

  if not found then
    raise exception 'Match not found';
  end if;

  if match_kickoff_at is null or now() < match_kickoff_at - interval '1 hour' then
    raise exception 'Match predictions are not visible yet';
  end if;

  return query
  select
    pr.user_id,
    coalesce(nullif(p.name, ''), 'Participante') as participant_name,
    p.avatar_url as participant_avatar_url,
    pr.user_id = current_user_id as is_current_user,
    pr.home_score,
    pr.away_score,
    pr.updated_at
  from public.predictions pr
  left join public.profiles p on p.id = pr.user_id
  where pr.pool_id = target_pool_id
    and pr.match_id = target_match_id
    and pr.home_score is not null
    and pr.away_score is not null
  order by
    coalesce(nullif(p.name, ''), 'Participante'),
    pr.updated_at;
end;
$$;

revoke all on function public.get_match_predictions_after_lock(uuid, uuid) from public;
grant execute on function public.get_match_predictions_after_lock(uuid, uuid) to authenticated;


-- ============================================================
-- 0022_live_leaderboard_rpc.sql
-- ============================================================

create or replace function public.get_pool_live_leaderboard_data(target_pool_id uuid)
returns table (
  user_id uuid,
  profile_name text,
  username text,
  avatar_url text,
  match_id uuid,
  round_number int,
  predicted_home_score int,
  predicted_away_score int,
  actual_home_score int,
  actual_away_score int,
  is_live_match boolean,
  live_matches_count int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can view live leaderboard data';
  end if;

  return query
  with scoped_matches as (
    select
      m.*,
      upper(coalesce(m.status_short, '')) in ('LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P') as is_live_or_halftime,
      upper(coalesce(m.status_short, '')) in ('FT', 'AET', 'PEN') as is_finished
    from public.matches m
  ),
  live_count as (
    select count(*)::int as value
    from scoped_matches sm
    where sm.is_live_or_halftime
  )
  select
    pm.user_id,
    p.name as profile_name,
    p.username,
    p.avatar_url,
    sm.id as match_id,
    sm.round_number,
    pr.home_score as predicted_home_score,
    pr.away_score as predicted_away_score,
    case
      when sm.is_finished then sm.home_score
      when sm.is_live_or_halftime
        and sm.home_score_live is not null
        and sm.away_score_live is not null
        then sm.home_score_live
      else null
    end as actual_home_score,
    case
      when sm.is_finished then sm.away_score
      when sm.is_live_or_halftime
        and sm.home_score_live is not null
        and sm.away_score_live is not null
        then sm.away_score_live
      else null
    end as actual_away_score,
    sm.is_live_or_halftime as is_live_match,
    lc.value as live_matches_count
  from public.pool_members pm
  cross join scoped_matches sm
  cross join live_count lc
  left join public.profiles p on p.id = pm.user_id
  left join public.predictions pr
    on pr.pool_id = pm.pool_id
    and pr.user_id = pm.user_id
    and pr.match_id = sm.id
  where pm.pool_id = target_pool_id
  order by
    lower(coalesce(p.name, '')),
    pm.user_id,
    sm.round_number,
    sm.created_at;
end;
$$;

revoke all on function public.get_pool_live_leaderboard_data(uuid) from public;
grant execute on function public.get_pool_live_leaderboard_data(uuid) to authenticated;


-- ============================================================
-- 0023_pool_recent_activity.sql
-- ============================================================

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


-- ============================================================
-- 0024_playoffs_first_version.sql
-- ============================================================

create table if not exists public.playoff_settings (
  pool_id uuid primary key references public.pools(id) on delete cascade,
  is_enabled boolean not null default false,
  first_match_kickoff_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playoff_matches (
  id uuid primary key default gen_random_uuid(),
  stage text not null check (
    stage in (
      'ROUND_OF_32',
      'ROUND_OF_16',
      'QUARTER_FINAL',
      'SEMI_FINAL',
      'FINAL'
    )
  ),
  position integer not null,
  home_team_id uuid null references public.teams(id),
  away_team_id uuid null references public.teams(id),
  source_home text null,
  source_away text null,
  kickoff_at timestamptz null,
  next_match_id uuid null references public.playoff_matches(id),
  next_match_slot text null check (next_match_slot in ('home', 'away')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(stage, position)
);

create table if not exists public.playoff_picks (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  playoff_match_id uuid not null references public.playoff_matches(id) on delete cascade,
  selected_team_id uuid not null references public.teams(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pool_id, user_id, playoff_match_id)
);

create index if not exists playoff_picks_pool_user_idx
on public.playoff_picks(pool_id, user_id);

create index if not exists playoff_picks_match_idx
on public.playoff_picks(playoff_match_id);

drop trigger if exists playoff_settings_touch_updated_at on public.playoff_settings;
create trigger playoff_settings_touch_updated_at
before update on public.playoff_settings
for each row execute function public.touch_updated_at();

drop trigger if exists playoff_matches_touch_updated_at on public.playoff_matches;
create trigger playoff_matches_touch_updated_at
before update on public.playoff_matches
for each row execute function public.touch_updated_at();

drop trigger if exists playoff_picks_touch_updated_at on public.playoff_picks;
create trigger playoff_picks_touch_updated_at
before update on public.playoff_picks
for each row execute function public.touch_updated_at();

alter table public.playoff_settings enable row level security;
alter table public.playoff_matches enable row level security;
alter table public.playoff_picks enable row level security;

drop policy if exists "Pool members can view playoff settings" on public.playoff_settings;
create policy "Pool members can view playoff settings"
on public.playoff_settings
for select
to authenticated
using (public.is_pool_member(pool_id));

drop policy if exists "Authenticated users can view playoff matches" on public.playoff_matches;

drop policy if exists "Users can view own playoff picks" on public.playoff_picks;
create policy "Users can view own playoff picks"
on public.playoff_picks
for select
to authenticated
using (user_id = auth.uid() and public.is_pool_member(pool_id));

create or replace function public.playoff_stage_order(stage_value text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case stage_value
    when 'ROUND_OF_32' then 1
    when 'ROUND_OF_16' then 2
    when 'QUARTER_FINAL' then 3
    when 'SEMI_FINAL' then 4
    when 'FINAL' then 5
    else 99
  end;
$$;

create or replace function public.playoff_default_lock_at()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select coalesce(
    min(kickoff_at),
    '2026-06-28 16:00:00-03'::timestamptz
  )
  from public.playoff_matches;
$$;

create or replace function public.ensure_playoff_settings(target_pool_id uuid)
returns public.playoff_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  settings_record public.playoff_settings%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can view playoff settings';
  end if;

  insert into public.playoff_settings(pool_id, is_enabled, first_match_kickoff_at)
  values (target_pool_id, false, public.playoff_default_lock_at())
  on conflict (pool_id) do nothing;

  select *
  into settings_record
  from public.playoff_settings
  where pool_id = target_pool_id;

  return settings_record;
end;
$$;

create or replace function public.get_playoff_bracket(target_pool_id uuid)
returns table (
  is_owner boolean,
  is_enabled boolean,
  can_access boolean,
  is_locked boolean,
  lock_at timestamptz,
  started_users_count integer,
  matches jsonb,
  picks jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  owner_access boolean;
  settings_record public.playoff_settings%rowtype;
  resolved_lock_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can view playoffs';
  end if;

  owner_access := public.is_pool_owner(target_pool_id);
  settings_record := public.ensure_playoff_settings(target_pool_id);
  resolved_lock_at := coalesce(
    settings_record.first_match_kickoff_at,
    public.playoff_default_lock_at()
  );

  return query
  select
    owner_access as is_owner,
    settings_record.is_enabled as is_enabled,
    (owner_access or settings_record.is_enabled) as can_access,
    now() >= resolved_lock_at as is_locked,
    resolved_lock_at as lock_at,
    (
      select count(distinct pp.user_id)::integer
      from public.playoff_picks pp
      where pp.pool_id = target_pool_id
    ) as started_users_count,
    case
      when owner_access or settings_record.is_enabled then
        (
          select coalesce(jsonb_agg(match_payload order by stage_order, position), '[]'::jsonb)
          from (
            select
              public.playoff_stage_order(pm.stage) as stage_order,
              pm.position,
              jsonb_build_object(
                'id', pm.id,
                'stage', pm.stage,
                'position', pm.position,
                'homeTeamId', pm.home_team_id,
                'awayTeamId', pm.away_team_id,
                'sourceHome', pm.source_home,
                'sourceAway', pm.source_away,
                'kickoffAt', pm.kickoff_at,
                'nextMatchId', pm.next_match_id,
                'nextMatchSlot', pm.next_match_slot,
                'homeTeam', case
                  when ht.id is null then null
                  else jsonb_build_object(
                    'id', ht.id,
                    'name', ht.name,
                    'code', ht.code,
                    'flagUrl', ht.flag_url
                  )
                end,
                'awayTeam', case
                  when at.id is null then null
                  else jsonb_build_object(
                    'id', at.id,
                    'name', at.name,
                    'code', at.code,
                    'flagUrl', at.flag_url
                  )
                end
              ) as match_payload
            from public.playoff_matches pm
            left join public.teams ht on ht.id = pm.home_team_id
            left join public.teams at on at.id = pm.away_team_id
          ) payload
        )
      else '[]'::jsonb
    end as matches,
    case
      when owner_access or settings_record.is_enabled then
        (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', pp.id,
            'playoffMatchId', pp.playoff_match_id,
            'selectedTeamId', pp.selected_team_id,
            'createdAt', pp.created_at,
            'updatedAt', pp.updated_at
          ) order by pp.updated_at), '[]'::jsonb)
          from public.playoff_picks pp
          where pp.pool_id = target_pool_id
            and pp.user_id = current_user_id
        )
      else '[]'::jsonb
    end as picks;
end;
$$;

create or replace function public.playoff_allowed_team_ids(
  target_pool_id uuid,
  target_user_id uuid,
  target_match_id uuid
)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select array_remove(array[
    coalesce(
      target_match.home_team_id,
      (
        select source_pick.selected_team_id
        from public.playoff_matches source_match
        join public.playoff_picks source_pick
          on source_pick.playoff_match_id = source_match.id
          and source_pick.pool_id = target_pool_id
          and source_pick.user_id = target_user_id
        where source_match.next_match_id = target_match.id
          and source_match.next_match_slot = 'home'
        limit 1
      )
    ),
    coalesce(
      target_match.away_team_id,
      (
        select source_pick.selected_team_id
        from public.playoff_matches source_match
        join public.playoff_picks source_pick
          on source_pick.playoff_match_id = source_match.id
          and source_pick.pool_id = target_pool_id
          and source_pick.user_id = target_user_id
        where source_match.next_match_id = target_match.id
          and source_match.next_match_slot = 'away'
        limit 1
      )
    )
  ], null)
  from public.playoff_matches target_match
  where target_match.id = target_match_id;
$$;

create or replace function public.save_playoff_pick(
  target_pool_id uuid,
  target_playoff_match_id uuid,
  target_selected_team_id uuid
)
returns table (
  id uuid,
  pool_id uuid,
  user_id uuid,
  playoff_match_id uuid,
  selected_team_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  settings_record public.playoff_settings%rowtype;
  resolved_lock_at timestamptz;
  owner_access boolean;
  allowed_team_ids uuid[];
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can save playoff picks';
  end if;

  owner_access := public.is_pool_owner(target_pool_id);
  settings_record := public.ensure_playoff_settings(target_pool_id);
  resolved_lock_at := coalesce(
    settings_record.first_match_kickoff_at,
    public.playoff_default_lock_at()
  );

  if not owner_access and not settings_record.is_enabled then
    raise exception 'Playoffs are not enabled for participants yet';
  end if;

  if now() >= resolved_lock_at then
    raise exception 'Playoff picks are locked';
  end if;

  select public.playoff_allowed_team_ids(
    target_pool_id,
    current_user_id,
    target_playoff_match_id
  )
  into allowed_team_ids;

  if allowed_team_ids is null or array_length(allowed_team_ids, 1) < 2 then
    raise exception 'This playoff match is not ready for picks';
  end if;

  if target_selected_team_id <> all(allowed_team_ids) then
    raise exception 'Selected team does not belong to this playoff match';
  end if;

  insert into public.playoff_picks as target_pick (
    pool_id,
    user_id,
    playoff_match_id,
    selected_team_id
  )
  values (
    target_pool_id,
    current_user_id,
    target_playoff_match_id,
    target_selected_team_id
  )
  on conflict on constraint playoff_picks_pool_id_user_id_playoff_match_id_key
  do update set
    selected_team_id = excluded.selected_team_id,
    updated_at = now();

  with recursive downstream(match_id) as (
    select pm.next_match_id
    from public.playoff_matches pm
    where pm.id = target_playoff_match_id
      and pm.next_match_id is not null

    union

    select next_pm.next_match_id
    from public.playoff_matches next_pm
    join downstream d on d.match_id = next_pm.id
    where next_pm.next_match_id is not null
  )
  delete from public.playoff_picks pp
  using downstream d
  where pp.pool_id = target_pool_id
    and pp.user_id = current_user_id
    and pp.playoff_match_id = d.match_id;

  return query
  select
    pp.id,
    pp.pool_id,
    pp.user_id,
    pp.playoff_match_id,
    pp.selected_team_id,
    pp.created_at,
    pp.updated_at
  from public.playoff_picks pp
  where pp.pool_id = target_pool_id
    and pp.user_id = current_user_id
    and pp.playoff_match_id = target_playoff_match_id;
end;
$$;

create or replace function public.admin_set_playoffs_enabled(
  target_pool_id uuid,
  target_enabled boolean
)
returns table (
  pool_id uuid,
  is_enabled boolean,
  first_match_kickoff_at timestamptz,
  is_locked boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  settings_record public.playoff_settings%rowtype;
  resolved_lock_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_owner(target_pool_id) then
    raise exception 'Only pool owners can update playoff access';
  end if;

  settings_record := public.ensure_playoff_settings(target_pool_id);
  resolved_lock_at := coalesce(
    settings_record.first_match_kickoff_at,
    public.playoff_default_lock_at()
  );

  if now() >= resolved_lock_at then
    raise exception 'Playoffs are locked';
  end if;

  update public.playoff_settings ps
  set is_enabled = target_enabled
  where ps.pool_id = target_pool_id
  returning *
  into settings_record;

  return query
  select
    settings_record.pool_id,
    settings_record.is_enabled,
    settings_record.first_match_kickoff_at,
    now() >= resolved_lock_at,
    settings_record.updated_at;
end;
$$;

revoke all on function public.playoff_stage_order(text) from public;
revoke all on function public.playoff_default_lock_at() from public;
revoke all on function public.ensure_playoff_settings(uuid) from public;
revoke all on function public.get_playoff_bracket(uuid) from public;
revoke all on function public.playoff_allowed_team_ids(uuid, uuid, uuid) from public;
revoke all on function public.save_playoff_pick(uuid, uuid, uuid) from public;
revoke all on function public.admin_set_playoffs_enabled(uuid, boolean) from public;

grant execute on function public.get_playoff_bracket(uuid) to authenticated;
grant execute on function public.save_playoff_pick(uuid, uuid, uuid) to authenticated;
grant execute on function public.admin_set_playoffs_enabled(uuid, boolean) to authenticated;

insert into public.playoff_matches (
  id,
  stage,
  position,
  source_home,
  source_away,
  kickoff_at,
  next_match_id,
  next_match_slot
)
values
  ('10000000-0000-0000-0000-000000000001', 'ROUND_OF_32', 1, 'Classificado 1', 'Classificado 2', '2026-06-28 16:00:00-03', '10000000-0000-0000-0000-000000000017', 'home'),
  ('10000000-0000-0000-0000-000000000002', 'ROUND_OF_32', 2, 'Classificado 3', 'Classificado 4', null, '10000000-0000-0000-0000-000000000017', 'away'),
  ('10000000-0000-0000-0000-000000000003', 'ROUND_OF_32', 3, 'Classificado 5', 'Classificado 6', null, '10000000-0000-0000-0000-000000000018', 'home'),
  ('10000000-0000-0000-0000-000000000004', 'ROUND_OF_32', 4, 'Classificado 7', 'Classificado 8', null, '10000000-0000-0000-0000-000000000018', 'away'),
  ('10000000-0000-0000-0000-000000000005', 'ROUND_OF_32', 5, 'Classificado 9', 'Classificado 10', null, '10000000-0000-0000-0000-000000000019', 'home'),
  ('10000000-0000-0000-0000-000000000006', 'ROUND_OF_32', 6, 'Classificado 11', 'Classificado 12', null, '10000000-0000-0000-0000-000000000019', 'away'),
  ('10000000-0000-0000-0000-000000000007', 'ROUND_OF_32', 7, 'Classificado 13', 'Classificado 14', null, '10000000-0000-0000-0000-000000000020', 'home'),
  ('10000000-0000-0000-0000-000000000008', 'ROUND_OF_32', 8, 'Classificado 15', 'Classificado 16', null, '10000000-0000-0000-0000-000000000020', 'away'),
  ('10000000-0000-0000-0000-000000000009', 'ROUND_OF_32', 9, 'Classificado 17', 'Classificado 18', null, '10000000-0000-0000-0000-000000000021', 'home'),
  ('10000000-0000-0000-0000-000000000010', 'ROUND_OF_32', 10, 'Classificado 19', 'Classificado 20', null, '10000000-0000-0000-0000-000000000021', 'away'),
  ('10000000-0000-0000-0000-000000000011', 'ROUND_OF_32', 11, 'Classificado 21', 'Classificado 22', null, '10000000-0000-0000-0000-000000000022', 'home'),
  ('10000000-0000-0000-0000-000000000012', 'ROUND_OF_32', 12, 'Classificado 23', 'Classificado 24', null, '10000000-0000-0000-0000-000000000022', 'away'),
  ('10000000-0000-0000-0000-000000000013', 'ROUND_OF_32', 13, 'Classificado 25', 'Classificado 26', null, '10000000-0000-0000-0000-000000000023', 'home'),
  ('10000000-0000-0000-0000-000000000014', 'ROUND_OF_32', 14, 'Classificado 27', 'Classificado 28', null, '10000000-0000-0000-0000-000000000023', 'away'),
  ('10000000-0000-0000-0000-000000000015', 'ROUND_OF_32', 15, 'Classificado 29', 'Classificado 30', null, '10000000-0000-0000-0000-000000000024', 'home'),
  ('10000000-0000-0000-0000-000000000016', 'ROUND_OF_32', 16, 'Classificado 31', 'Classificado 32', null, '10000000-0000-0000-0000-000000000024', 'away'),
  ('10000000-0000-0000-0000-000000000017', 'ROUND_OF_16', 1, 'Vencedor 1', 'Vencedor 2', null, '10000000-0000-0000-0000-000000000025', 'home'),
  ('10000000-0000-0000-0000-000000000018', 'ROUND_OF_16', 2, 'Vencedor 3', 'Vencedor 4', null, '10000000-0000-0000-0000-000000000025', 'away'),
  ('10000000-0000-0000-0000-000000000019', 'ROUND_OF_16', 3, 'Vencedor 5', 'Vencedor 6', null, '10000000-0000-0000-0000-000000000026', 'home'),
  ('10000000-0000-0000-0000-000000000020', 'ROUND_OF_16', 4, 'Vencedor 7', 'Vencedor 8', null, '10000000-0000-0000-0000-000000000026', 'away'),
  ('10000000-0000-0000-0000-000000000021', 'ROUND_OF_16', 5, 'Vencedor 9', 'Vencedor 10', null, '10000000-0000-0000-0000-000000000027', 'home'),
  ('10000000-0000-0000-0000-000000000022', 'ROUND_OF_16', 6, 'Vencedor 11', 'Vencedor 12', null, '10000000-0000-0000-0000-000000000027', 'away'),
  ('10000000-0000-0000-0000-000000000023', 'ROUND_OF_16', 7, 'Vencedor 13', 'Vencedor 14', null, '10000000-0000-0000-0000-000000000028', 'home'),
  ('10000000-0000-0000-0000-000000000024', 'ROUND_OF_16', 8, 'Vencedor 15', 'Vencedor 16', null, '10000000-0000-0000-0000-000000000028', 'away'),
  ('10000000-0000-0000-0000-000000000025', 'QUARTER_FINAL', 1, 'Vencedor Oitavas 1', 'Vencedor Oitavas 2', null, '10000000-0000-0000-0000-000000000029', 'home'),
  ('10000000-0000-0000-0000-000000000026', 'QUARTER_FINAL', 2, 'Vencedor Oitavas 3', 'Vencedor Oitavas 4', null, '10000000-0000-0000-0000-000000000029', 'away'),
  ('10000000-0000-0000-0000-000000000027', 'QUARTER_FINAL', 3, 'Vencedor Oitavas 5', 'Vencedor Oitavas 6', null, '10000000-0000-0000-0000-000000000030', 'home'),
  ('10000000-0000-0000-0000-000000000028', 'QUARTER_FINAL', 4, 'Vencedor Oitavas 7', 'Vencedor Oitavas 8', null, '10000000-0000-0000-0000-000000000030', 'away'),
  ('10000000-0000-0000-0000-000000000029', 'SEMI_FINAL', 1, 'Vencedor Quartas 1', 'Vencedor Quartas 2', null, '10000000-0000-0000-0000-000000000031', 'home'),
  ('10000000-0000-0000-0000-000000000030', 'SEMI_FINAL', 2, 'Vencedor Quartas 3', 'Vencedor Quartas 4', null, '10000000-0000-0000-0000-000000000031', 'away'),
  ('10000000-0000-0000-0000-000000000031', 'FINAL', 1, 'Vencedor Semi 1', 'Vencedor Semi 2', null, null, null)
on conflict (id) do nothing;


-- ============================================================
-- 0025_restrict_playoffs_to_owners.sql
-- ============================================================

create or replace function public.get_playoff_bracket(target_pool_id uuid)
returns table (
  is_owner boolean,
  is_enabled boolean,
  can_access boolean,
  is_locked boolean,
  lock_at timestamptz,
  started_users_count integer,
  matches jsonb,
  picks jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  owner_access boolean;
  settings_record public.playoff_settings%rowtype;
  resolved_lock_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can view playoffs';
  end if;

  owner_access := public.is_pool_owner(target_pool_id);
  settings_record := public.ensure_playoff_settings(target_pool_id);
  resolved_lock_at := coalesce(
    settings_record.first_match_kickoff_at,
    public.playoff_default_lock_at()
  );

  return query
  select
    owner_access as is_owner,
    settings_record.is_enabled as is_enabled,
    owner_access as can_access,
    now() >= resolved_lock_at as is_locked,
    resolved_lock_at as lock_at,
    (
      select count(distinct pp.user_id)::integer
      from public.playoff_picks pp
      where pp.pool_id = target_pool_id
    ) as started_users_count,
    case
      when owner_access then
        (
          select coalesce(jsonb_agg(match_payload order by stage_order, position), '[]'::jsonb)
          from (
            select
              public.playoff_stage_order(pm.stage) as stage_order,
              pm.position,
              jsonb_build_object(
                'id', pm.id,
                'stage', pm.stage,
                'position', pm.position,
                'homeTeamId', pm.home_team_id,
                'awayTeamId', pm.away_team_id,
                'sourceHome', pm.source_home,
                'sourceAway', pm.source_away,
                'kickoffAt', pm.kickoff_at,
                'nextMatchId', pm.next_match_id,
                'nextMatchSlot', pm.next_match_slot,
                'homeTeam', case
                  when ht.id is null then null
                  else jsonb_build_object(
                    'id', ht.id,
                    'name', ht.name,
                    'code', ht.code,
                    'flagUrl', ht.flag_url
                  )
                end,
                'awayTeam', case
                  when at.id is null then null
                  else jsonb_build_object(
                    'id', at.id,
                    'name', at.name,
                    'code', at.code,
                    'flagUrl', at.flag_url
                  )
                end
              ) as match_payload
            from public.playoff_matches pm
            left join public.teams ht on ht.id = pm.home_team_id
            left join public.teams at on at.id = pm.away_team_id
          ) payload
        )
      else '[]'::jsonb
    end as matches,
    case
      when owner_access then
        (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', pp.id,
            'playoffMatchId', pp.playoff_match_id,
            'selectedTeamId', pp.selected_team_id,
            'createdAt', pp.created_at,
            'updatedAt', pp.updated_at
          ) order by pp.updated_at), '[]'::jsonb)
          from public.playoff_picks pp
          where pp.pool_id = target_pool_id
            and pp.user_id = current_user_id
        )
      else '[]'::jsonb
    end as picks;
end;
$$;

create or replace function public.save_playoff_pick(
  target_pool_id uuid,
  target_playoff_match_id uuid,
  target_selected_team_id uuid
)
returns table (
  id uuid,
  pool_id uuid,
  user_id uuid,
  playoff_match_id uuid,
  selected_team_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  settings_record public.playoff_settings%rowtype;
  resolved_lock_at timestamptz;
  allowed_team_ids uuid[];
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can save playoff picks';
  end if;

  if not public.is_pool_owner(target_pool_id) then
    raise exception 'Only pool owners can save playoff picks';
  end if;

  settings_record := public.ensure_playoff_settings(target_pool_id);
  resolved_lock_at := coalesce(
    settings_record.first_match_kickoff_at,
    public.playoff_default_lock_at()
  );

  if now() >= resolved_lock_at then
    raise exception 'Playoff picks are locked';
  end if;

  select public.playoff_allowed_team_ids(
    target_pool_id,
    current_user_id,
    target_playoff_match_id
  )
  into allowed_team_ids;

  if allowed_team_ids is null or array_length(allowed_team_ids, 1) < 2 then
    raise exception 'This playoff match is not ready for picks';
  end if;

  if target_selected_team_id <> all(allowed_team_ids) then
    raise exception 'Selected team does not belong to this playoff match';
  end if;

  insert into public.playoff_picks as target_pick (
    pool_id,
    user_id,
    playoff_match_id,
    selected_team_id
  )
  values (
    target_pool_id,
    current_user_id,
    target_playoff_match_id,
    target_selected_team_id
  )
  on conflict on constraint playoff_picks_pool_id_user_id_playoff_match_id_key
  do update set
    selected_team_id = excluded.selected_team_id,
    updated_at = now();

  with recursive downstream(match_id) as (
    select pm.next_match_id
    from public.playoff_matches pm
    where pm.id = target_playoff_match_id
      and pm.next_match_id is not null

    union

    select next_pm.next_match_id
    from public.playoff_matches next_pm
    join downstream d on d.match_id = next_pm.id
    where next_pm.next_match_id is not null
  )
  delete from public.playoff_picks pp
  using downstream d
  where pp.pool_id = target_pool_id
    and pp.user_id = current_user_id
    and pp.playoff_match_id = d.match_id;

  return query
  select
    pp.id,
    pp.pool_id,
    pp.user_id,
    pp.playoff_match_id,
    pp.selected_team_id,
    pp.created_at,
    pp.updated_at
  from public.playoff_picks pp
  where pp.pool_id = target_pool_id
    and pp.user_id = current_user_id
    and pp.playoff_match_id = target_playoff_match_id;
end;
$$;


-- ============================================================
-- 0026_global_predictions_and_default_pool.sql
-- ============================================================

alter table public.pools
add column if not exists description text;

alter table public.pools
add column if not exists type text not null default 'private';

alter table public.pools
add column if not exists is_default boolean not null default false;

alter table public.pools
alter column owner_id drop not null;

do $$
begin
  alter table public.pools
  add constraint pools_type_check check (type in ('general', 'private'));
exception
  when duplicate_object then null;
end;
$$;

create unique index if not exists pools_single_default_idx
on public.pools (is_default)
where is_default;

create index if not exists predictions_user_match_idx
on public.predictions(user_id, match_id, updated_at desc);

create or replace function public.ensure_default_pool_membership(
  preferred_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  default_pool_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtext('default-pool'));

  select p.id
  into default_pool_id
  from public.pools p
  where p.is_default
  order by p.created_at, p.id
  limit 1;

  if default_pool_id is null then
    insert into public.pools (
      name,
      description,
      type,
      is_default,
      owner_id
    )
    values (
      'Bolao Geral',
      'Bolao padrao para todos os participantes.',
      'general',
      true,
      null
    )
    returning id into default_pool_id;
  end if;

  insert into public.pool_members (
    pool_id,
    user_id,
    role
  )
  values (
    default_pool_id,
    current_user_id,
    'member'
  )
  on conflict (pool_id, user_id) do nothing;

  perform *
  from public.ensure_user_profile_for_pool(default_pool_id, preferred_name);

  return default_pool_id;
end;
$$;

revoke all on function public.ensure_default_pool_membership(text) from public;
grant execute on function public.ensure_default_pool_membership(text) to authenticated;

create or replace function public.save_prediction(
  target_pool_id uuid,
  target_match_id uuid,
  predicted_home_score integer,
  predicted_away_score integer
)
returns table (
  id uuid,
  pool_id uuid,
  user_id uuid,
  match_id uuid,
  home_score integer,
  away_score integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  match_kickoff_at timestamptz;
  existing_prediction_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can save predictions';
  end if;

  select m.kickoff_at
  into match_kickoff_at
  from public.matches m
  where m.id = target_match_id;

  if not found then
    raise exception 'Match not found';
  end if;

  if match_kickoff_at is not null and now() >= match_kickoff_at - interval '1 hour' then
    raise exception 'Prediction locked because match starts within one hour';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('prediction:' || current_user_id::text || ':' || target_match_id::text)
  );

  select pr.id
  into existing_prediction_id
  from public.predictions pr
  where pr.user_id = current_user_id
    and pr.match_id = target_match_id
  order by pr.updated_at desc, pr.created_at desc, pr.id
  limit 1;

  if existing_prediction_id is not null then
    return query
    update public.predictions as target_prediction
    set
      home_score = predicted_home_score,
      away_score = predicted_away_score,
      updated_at = now()
    where target_prediction.id = existing_prediction_id
    returning
      target_prediction.id,
      target_pool_id,
      target_prediction.user_id,
      target_prediction.match_id,
      target_prediction.home_score,
      target_prediction.away_score,
      target_prediction.created_at,
      target_prediction.updated_at;

    return;
  end if;

  return query
  insert into public.predictions as target_prediction (
    pool_id,
    user_id,
    match_id,
    home_score,
    away_score,
    updated_at
  )
  values (
    target_pool_id,
    current_user_id,
    target_match_id,
    predicted_home_score,
    predicted_away_score,
    now()
  )
  returning
    target_prediction.id,
    target_pool_id,
    target_prediction.user_id,
    target_prediction.match_id,
    target_prediction.home_score,
    target_prediction.away_score,
    target_prediction.created_at,
    target_prediction.updated_at;
end;
$$;

revoke all on function public.save_prediction(uuid, uuid, integer, integer) from public;
grant execute on function public.save_prediction(uuid, uuid, integer, integer) to authenticated;

create or replace function public.get_pool_leaderboard_data(target_pool_id uuid)
returns table (
  user_id uuid,
  profile_name text,
  username text,
  avatar_url text,
  match_id uuid,
  round_number int,
  predicted_home_score int,
  predicted_away_score int,
  actual_home_score int,
  actual_away_score int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can view leaderboard data';
  end if;

  return query
  select
    pm.user_id,
    p.name as profile_name,
    p.username,
    p.avatar_url,
    m.id as match_id,
    m.round_number,
    pr.home_score as predicted_home_score,
    pr.away_score as predicted_away_score,
    m.home_score as actual_home_score,
    m.away_score as actual_away_score
  from public.pool_members pm
  cross join public.matches m
  left join public.profiles p on p.id = pm.user_id
  left join lateral (
    select latest_pr.*
    from public.predictions latest_pr
    where latest_pr.user_id = pm.user_id
      and latest_pr.match_id = m.id
    order by latest_pr.updated_at desc, latest_pr.created_at desc, latest_pr.id
    limit 1
  ) pr on true
  where pm.pool_id = target_pool_id
  order by
    lower(coalesce(p.name, '')),
    pm.user_id,
    m.round_number,
    m.created_at;
end;
$$;

revoke all on function public.get_pool_leaderboard_data(uuid) from public;
grant execute on function public.get_pool_leaderboard_data(uuid) to authenticated;

create or replace function public.get_pool_live_leaderboard_data(target_pool_id uuid)
returns table (
  user_id uuid,
  profile_name text,
  username text,
  avatar_url text,
  match_id uuid,
  round_number int,
  predicted_home_score int,
  predicted_away_score int,
  actual_home_score int,
  actual_away_score int,
  is_live_match boolean,
  live_matches_count int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can view live leaderboard data';
  end if;

  return query
  with scoped_matches as (
    select
      m.*,
      upper(coalesce(m.status_short, '')) in ('LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P') as is_live_or_halftime,
      upper(coalesce(m.status_short, '')) in ('FT', 'AET', 'PEN') as is_finished
    from public.matches m
  ),
  live_count as (
    select count(*)::int as value
    from scoped_matches sm
    where sm.is_live_or_halftime
  )
  select
    pm.user_id,
    p.name as profile_name,
    p.username,
    p.avatar_url,
    sm.id as match_id,
    sm.round_number,
    pr.home_score as predicted_home_score,
    pr.away_score as predicted_away_score,
    case
      when sm.is_finished then sm.home_score
      when sm.is_live_or_halftime
        and sm.home_score_live is not null
        and sm.away_score_live is not null
        then sm.home_score_live
      else null
    end as actual_home_score,
    case
      when sm.is_finished then sm.away_score
      when sm.is_live_or_halftime
        and sm.home_score_live is not null
        and sm.away_score_live is not null
        then sm.away_score_live
      else null
    end as actual_away_score,
    sm.is_live_or_halftime as is_live_match,
    lc.value as live_matches_count
  from public.pool_members pm
  cross join scoped_matches sm
  cross join live_count lc
  left join public.profiles p on p.id = pm.user_id
  left join lateral (
    select latest_pr.*
    from public.predictions latest_pr
    where latest_pr.user_id = pm.user_id
      and latest_pr.match_id = sm.id
    order by latest_pr.updated_at desc, latest_pr.created_at desc, latest_pr.id
    limit 1
  ) pr on true
  where pm.pool_id = target_pool_id
  order by
    lower(coalesce(p.name, '')),
    pm.user_id,
    sm.round_number,
    sm.created_at;
end;
$$;

revoke all on function public.get_pool_live_leaderboard_data(uuid) from public;
grant execute on function public.get_pool_live_leaderboard_data(uuid) to authenticated;

create or replace function public.get_match_predictions_after_lock(
  target_pool_id uuid,
  target_match_id uuid
)
returns table (
  user_id uuid,
  participant_name text,
  participant_avatar_url text,
  is_current_user boolean,
  home_score integer,
  away_score integer,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  match_kickoff_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(target_pool_id) then
    raise exception 'Only pool members can view match predictions';
  end if;

  select m.kickoff_at
  into match_kickoff_at
  from public.matches m
  where m.id = target_match_id;

  if not found then
    raise exception 'Match not found';
  end if;

  if match_kickoff_at is null or now() < match_kickoff_at - interval '1 hour' then
    raise exception 'Match predictions are not visible yet';
  end if;

  return query
  select
    pm.user_id,
    coalesce(nullif(p.name, ''), 'Participante') as participant_name,
    p.avatar_url as participant_avatar_url,
    pm.user_id = current_user_id as is_current_user,
    pr.home_score,
    pr.away_score,
    pr.updated_at
  from public.pool_members pm
  join lateral (
    select latest_pr.*
    from public.predictions latest_pr
    where latest_pr.user_id = pm.user_id
      and latest_pr.match_id = target_match_id
      and latest_pr.home_score is not null
      and latest_pr.away_score is not null
    order by latest_pr.updated_at desc, latest_pr.created_at desc, latest_pr.id
    limit 1
  ) pr on true
  left join public.profiles p on p.id = pm.user_id
  where pm.pool_id = target_pool_id
  order by
    coalesce(nullif(p.name, ''), 'Participante'),
    pr.updated_at;
end;
$$;

revoke all on function public.get_match_predictions_after_lock(uuid, uuid) from public;
grant execute on function public.get_match_predictions_after_lock(uuid, uuid) to authenticated;

create or replace function public.get_visible_user_predictions_by_username(
  p_target_pool_id uuid,
  p_target_username text
)
returns table (
  target_user_id uuid,
  target_name text,
  target_username text,
  target_avatar_url text,
  is_current_user boolean,
  blocked_predictions_count int,
  prediction_id uuid,
  match_id uuid,
  group_id uuid,
  group_name text,
  round_number int,
  kickoff_at timestamptz,
  home_team_name text,
  home_team_code text,
  away_team_name text,
  away_team_code text,
  predicted_home_score int,
  predicted_away_score int,
  actual_home_score int,
  actual_away_score int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_profile public.profiles%rowtype;
  is_self boolean;
  blocked_count int := 0;
  visible_count int := 0;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_pool_member(p_target_pool_id) then
    raise exception 'Only pool members can view public profiles';
  end if;

  select *
  into target_profile
  from public.profiles p
  where lower(p.username) = lower(public.slugify_username(p_target_username));

  if target_profile.id is null then
    raise exception 'Profile not found';
  end if;

  if not exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = p_target_pool_id
      and pm.user_id = target_profile.id
  ) then
    raise exception 'Profile not found in this pool';
  end if;

  is_self := target_profile.id = current_user_id;

  if not is_self then
    with latest_predictions as (
      select distinct on (pr.user_id, pr.match_id)
        pr.*
      from public.predictions pr
      where pr.user_id = target_profile.id
      order by pr.user_id, pr.match_id, pr.updated_at desc, pr.created_at desc, pr.id
    )
    select count(*)::int
    into blocked_count
    from latest_predictions pr
    join public.matches m on m.id = pr.match_id
    where pr.home_score is not null
      and pr.away_score is not null
      and (m.kickoff_at is null or m.kickoff_at > now());
  end if;

  with latest_predictions as (
    select distinct on (pr.user_id, pr.match_id)
      pr.*
    from public.predictions pr
    where pr.user_id = target_profile.id
    order by pr.user_id, pr.match_id, pr.updated_at desc, pr.created_at desc, pr.id
  )
  select count(*)::int
  into visible_count
  from latest_predictions pr
  join public.matches m on m.id = pr.match_id
  where pr.home_score is not null
    and pr.away_score is not null
    and (
      is_self
      or (m.kickoff_at is not null and m.kickoff_at <= now())
    );

  if visible_count = 0 then
    return query
    select
      target_profile.id,
      target_profile.name,
      target_profile.username,
      target_profile.avatar_url,
      is_self,
      blocked_count,
      null::uuid,
      null::uuid,
      null::uuid,
      null::text,
      null::int,
      null::timestamptz,
      null::text,
      null::text,
      null::text,
      null::text,
      null::int,
      null::int,
      null::int,
      null::int;
    return;
  end if;

  return query
  with latest_predictions as (
    select distinct on (pr.user_id, pr.match_id)
      pr.*
    from public.predictions pr
    where pr.user_id = target_profile.id
    order by pr.user_id, pr.match_id, pr.updated_at desc, pr.created_at desc, pr.id
  )
  select
    target_profile.id,
    target_profile.name,
    target_profile.username,
    target_profile.avatar_url,
    is_self,
    blocked_count,
    pr.id as prediction_id,
    m.id as match_id,
    g.id as group_id,
    g.name as group_name,
    m.round_number,
    m.kickoff_at,
    home_team.name as home_team_name,
    home_team.code as home_team_code,
    away_team.name as away_team_name,
    away_team.code as away_team_code,
    pr.home_score as predicted_home_score,
    pr.away_score as predicted_away_score,
    m.home_score as actual_home_score,
    m.away_score as actual_away_score
  from latest_predictions pr
  join public.matches m on m.id = pr.match_id
  join public.groups g on g.id = m.group_id
  join public.teams home_team on home_team.id = m.home_team_id
  join public.teams away_team on away_team.id = m.away_team_id
  where pr.home_score is not null
    and pr.away_score is not null
    and (
      is_self
      or (m.kickoff_at is not null and m.kickoff_at <= now())
    )
  order by
    g.name,
    m.round_number,
    m.kickoff_at nulls last,
    m.created_at;
end;
$$;

revoke all on function public.get_visible_user_predictions_by_username(uuid, text) from public;
grant execute on function public.get_visible_user_predictions_by_username(uuid, text) to authenticated;

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
    join public.pool_members pm on pm.pool_id = target_pool_id
    join lateral (
      select latest_pr.*
      from public.predictions latest_pr
      where latest_pr.user_id = pm.user_id
        and latest_pr.match_id = m.id
        and latest_pr.home_score = m.home_score
        and latest_pr.away_score = m.away_score
      order by latest_pr.updated_at desc, latest_pr.created_at desc, latest_pr.id
      limit 1
    ) pr on true
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


-- ============================================================
-- 0027_private_pools.sql
-- ============================================================

create or replace function public.create_private_pool(
  target_name text,
  target_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  resolved_name text := nullif(trim(target_name), '');
  resolved_description text := nullif(trim(target_description), '');
  created_pool_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if resolved_name is null then
    raise exception 'Pool name is required';
  end if;

  insert into public.pools (
    name,
    description,
    type,
    is_default,
    owner_id
  )
  values (
    resolved_name,
    resolved_description,
    'private',
    false,
    current_user_id
  )
  returning id into created_pool_id;

  insert into public.pool_members (
    pool_id,
    user_id,
    role
  )
  values (
    created_pool_id,
    current_user_id,
    'owner'
  )
  on conflict (pool_id, user_id) do update
  set role = 'owner';

  return created_pool_id;
end;
$$;

revoke all on function public.create_private_pool(text, text) from public;
grant execute on function public.create_private_pool(text, text) to authenticated;

-- 0028_pool_invite_codes.sql

alter table public.pools
add column if not exists invite_code text;

create unique index if not exists pools_invite_code_unique_idx
on public.pools (invite_code)
where invite_code is not null;

create or replace function public.generate_pool_invite_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));

    exit when not exists (
      select 1
      from public.pools p
      where p.invite_code = candidate
    );
  end loop;

  return candidate;
end;
$$;

update public.pools
set invite_code = public.generate_pool_invite_code()
where type = 'private'
  and invite_code is null;

create or replace function public.create_private_pool(
  target_name text,
  target_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  resolved_name text := nullif(trim(target_name), '');
  resolved_description text := nullif(trim(target_description), '');
  created_pool_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if resolved_name is null then
    raise exception 'Pool name is required';
  end if;

  insert into public.pools (
    name,
    description,
    type,
    is_default,
    owner_id,
    invite_code
  )
  values (
    resolved_name,
    resolved_description,
    'private',
    false,
    current_user_id,
    public.generate_pool_invite_code()
  )
  returning id into created_pool_id;

  insert into public.pool_members (
    pool_id,
    user_id,
    role
  )
  values (
    created_pool_id,
    current_user_id,
    'owner'
  )
  on conflict (pool_id, user_id) do update
  set role = 'owner';

  return created_pool_id;
end;
$$;

revoke all on function public.create_private_pool(text, text) from public;
grant execute on function public.create_private_pool(text, text) to authenticated;

create or replace function public.get_pool_invite_by_code(target_invite_code text)
returns table (
  pool_id uuid,
  pool_name text,
  pool_description text,
  invite_code text,
  is_valid boolean,
  is_member boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  pool_record public.pools%rowtype;
begin
  select *
  into pool_record
  from public.pools p
  where upper(p.invite_code) = upper(nullif(trim(target_invite_code), ''))
    and p.type = 'private'
    and p.is_default is not true;

  if pool_record.id is null then
    return query
    select
      null::uuid,
      null::text,
      null::text,
      null::text,
      false,
      false;
    return;
  end if;

  return query
  select
    pool_record.id,
    pool_record.name,
    pool_record.description,
    pool_record.invite_code,
    true,
    case
      when current_user_id is null then false
      else exists (
        select 1
        from public.pool_members pm
        where pm.pool_id = pool_record.id
          and pm.user_id = current_user_id
      )
    end;
end;
$$;

revoke all on function public.get_pool_invite_by_code(text) from public;
grant execute on function public.get_pool_invite_by_code(text) to anon, authenticated;

create or replace function public.join_pool_by_invite_code(target_invite_code text)
returns table (
  pool_id uuid,
  pool_name text,
  already_member boolean,
  joined boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  pool_record public.pools%rowtype;
  was_member boolean;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into pool_record
  from public.pools p
  where upper(p.invite_code) = upper(nullif(trim(target_invite_code), ''))
    and p.type = 'private'
    and p.is_default is not true;

  if pool_record.id is null then
    raise exception 'Invalid invite';
  end if;

  select exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = pool_record.id
      and pm.user_id = current_user_id
  )
  into was_member;

  insert into public.pool_members (
    pool_id,
    user_id,
    role
  )
  values (
    pool_record.id,
    current_user_id,
    'member'
  )
  on conflict (pool_id, user_id) do nothing;

  return query
  select
    pool_record.id,
    pool_record.name,
    was_member,
    not was_member;
end;
$$;

revoke all on function public.join_pool_by_invite_code(text) from public;
grant execute on function public.join_pool_by_invite_code(text) to authenticated;
