create or replace function public.knockout_round_order(round_value text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case round_value
    when 'round_of_32' then 1
    when 'round_of_16' then 2
    when 'quarterfinal' then 3
    when 'semifinal' then 4
    when 'final' then 5
    when 'third_place' then 6
    else 99
  end;
$$;

notify pgrst, 'reload schema';
