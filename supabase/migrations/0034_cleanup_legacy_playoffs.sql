drop function if exists public.admin_set_playoffs_enabled(uuid, boolean);
drop function if exists public.save_playoff_pick(uuid, uuid, uuid);
drop function if exists public.get_playoff_bracket(uuid);
drop function if exists public.ensure_playoff_settings(uuid);
drop function if exists public.playoff_allowed_team_ids(uuid, uuid, uuid);
drop function if exists public.playoff_default_lock_at();
drop function if exists public.playoff_stage_order(text);

drop table if exists public.playoff_picks;
drop table if exists public.playoff_settings;
drop table if exists public.playoff_matches;

notify pgrst, 'reload schema';
