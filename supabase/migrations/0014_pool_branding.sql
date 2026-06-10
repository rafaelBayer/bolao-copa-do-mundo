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
