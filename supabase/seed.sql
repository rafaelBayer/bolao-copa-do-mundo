-- Dados mockados apenas para desenvolvimento inicial.
-- Para producao, usar scripts/import-world-cup-2026.ts com data/world-cup-2026.ts.
-- Os nomes sao placeholders para evitar depender de dados oficiais mutaveis.

insert into public.groups (name)
select name
from (values
  ('Grupo A'), ('Grupo B'), ('Grupo C'), ('Grupo D'),
  ('Grupo E'), ('Grupo F'), ('Grupo G'), ('Grupo H')
) as seed(name)
on conflict (name) do nothing;

insert into public.teams (name, code)
select name, code
from (values
  ('Selecao A1', 'A1'), ('Selecao A2', 'A2'), ('Selecao A3', 'A3'), ('Selecao A4', 'A4'),
  ('Selecao B1', 'B1'), ('Selecao B2', 'B2'), ('Selecao B3', 'B3'), ('Selecao B4', 'B4'),
  ('Selecao C1', 'C1'), ('Selecao C2', 'C2'), ('Selecao C3', 'C3'), ('Selecao C4', 'C4'),
  ('Selecao D1', 'D1'), ('Selecao D2', 'D2'), ('Selecao D3', 'D3'), ('Selecao D4', 'D4'),
  ('Selecao E1', 'E1'), ('Selecao E2', 'E2'), ('Selecao E3', 'E3'), ('Selecao E4', 'E4'),
  ('Selecao F1', 'F1'), ('Selecao F2', 'F2'), ('Selecao F3', 'F3'), ('Selecao F4', 'F4'),
  ('Selecao G1', 'G1'), ('Selecao G2', 'G2'), ('Selecao G3', 'G3'), ('Selecao G4', 'G4'),
  ('Selecao H1', 'H1'), ('Selecao H2', 'H2'), ('Selecao H3', 'H3'), ('Selecao H4', 'H4')
) as seed(name, code)
where not exists (
  select 1 from public.teams existing where existing.code = seed.code
);

insert into public.group_teams (group_id, team_id, position)
select g.id, t.id, seed.position
from (values
  ('Grupo A', 'A1', 1), ('Grupo A', 'A2', 2), ('Grupo A', 'A3', 3), ('Grupo A', 'A4', 4),
  ('Grupo B', 'B1', 1), ('Grupo B', 'B2', 2), ('Grupo B', 'B3', 3), ('Grupo B', 'B4', 4),
  ('Grupo C', 'C1', 1), ('Grupo C', 'C2', 2), ('Grupo C', 'C3', 3), ('Grupo C', 'C4', 4),
  ('Grupo D', 'D1', 1), ('Grupo D', 'D2', 2), ('Grupo D', 'D3', 3), ('Grupo D', 'D4', 4),
  ('Grupo E', 'E1', 1), ('Grupo E', 'E2', 2), ('Grupo E', 'E3', 3), ('Grupo E', 'E4', 4),
  ('Grupo F', 'F1', 1), ('Grupo F', 'F2', 2), ('Grupo F', 'F3', 3), ('Grupo F', 'F4', 4),
  ('Grupo G', 'G1', 1), ('Grupo G', 'G2', 2), ('Grupo G', 'G3', 3), ('Grupo G', 'G4', 4),
  ('Grupo H', 'H1', 1), ('Grupo H', 'H2', 2), ('Grupo H', 'H3', 3), ('Grupo H', 'H4', 4)
) as seed(group_name, team_code, position)
join public.groups g on g.name = seed.group_name
join public.teams t on t.code = seed.team_code
on conflict (group_id, team_id) do nothing;

insert into public.matches (group_id, home_team_id, away_team_id, round_number)
select g.id, home_team.id, away_team.id, seed.round_number
from (values
  ('Grupo A', 'A1', 'A2', 1), ('Grupo A', 'A3', 'A4', 1), ('Grupo A', 'A1', 'A3', 2), ('Grupo A', 'A4', 'A2', 2), ('Grupo A', 'A4', 'A1', 3), ('Grupo A', 'A2', 'A3', 3),
  ('Grupo B', 'B1', 'B2', 1), ('Grupo B', 'B3', 'B4', 1), ('Grupo B', 'B1', 'B3', 2), ('Grupo B', 'B4', 'B2', 2), ('Grupo B', 'B4', 'B1', 3), ('Grupo B', 'B2', 'B3', 3),
  ('Grupo C', 'C1', 'C2', 1), ('Grupo C', 'C3', 'C4', 1), ('Grupo C', 'C1', 'C3', 2), ('Grupo C', 'C4', 'C2', 2), ('Grupo C', 'C4', 'C1', 3), ('Grupo C', 'C2', 'C3', 3),
  ('Grupo D', 'D1', 'D2', 1), ('Grupo D', 'D3', 'D4', 1), ('Grupo D', 'D1', 'D3', 2), ('Grupo D', 'D4', 'D2', 2), ('Grupo D', 'D4', 'D1', 3), ('Grupo D', 'D2', 'D3', 3),
  ('Grupo E', 'E1', 'E2', 1), ('Grupo E', 'E3', 'E4', 1), ('Grupo E', 'E1', 'E3', 2), ('Grupo E', 'E4', 'E2', 2), ('Grupo E', 'E4', 'E1', 3), ('Grupo E', 'E2', 'E3', 3),
  ('Grupo F', 'F1', 'F2', 1), ('Grupo F', 'F3', 'F4', 1), ('Grupo F', 'F1', 'F3', 2), ('Grupo F', 'F4', 'F2', 2), ('Grupo F', 'F4', 'F1', 3), ('Grupo F', 'F2', 'F3', 3),
  ('Grupo G', 'G1', 'G2', 1), ('Grupo G', 'G3', 'G4', 1), ('Grupo G', 'G1', 'G3', 2), ('Grupo G', 'G4', 'G2', 2), ('Grupo G', 'G4', 'G1', 3), ('Grupo G', 'G2', 'G3', 3),
  ('Grupo H', 'H1', 'H2', 1), ('Grupo H', 'H3', 'H4', 1), ('Grupo H', 'H1', 'H3', 2), ('Grupo H', 'H4', 'H2', 2), ('Grupo H', 'H4', 'H1', 3), ('Grupo H', 'H2', 'H3', 3)
) as seed(group_name, home_code, away_code, round_number)
join public.groups g on g.name = seed.group_name
join public.teams home_team on home_team.code = seed.home_code
join public.teams away_team on away_team.code = seed.away_code
where not exists (
  select 1
  from public.matches existing
  where existing.group_id = g.id
    and existing.home_team_id = home_team.id
    and existing.away_team_id = away_team.id
);
