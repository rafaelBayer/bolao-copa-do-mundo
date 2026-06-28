alter table public.knockout_matches
drop constraint if exists knockout_matches_round_check;

alter table public.knockout_matches
add constraint knockout_matches_round_check
check (
  round in (
    'round_of_32',
    'round_of_16',
    'quarterfinal',
    'semifinal',
    'final',
    'third_place'
  )
);

notify pgrst, 'reload schema';
