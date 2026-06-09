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
