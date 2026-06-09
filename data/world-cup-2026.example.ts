import type { WorldCupSeedData } from "../types/worldCupData";

// Example only. This is not official FIFA data and is not used by the import.
export const worldCup2026ExampleData: WorldCupSeedData = {
  tournament: "FIFA World Cup 2026",
  source: "Example only - not official",
  updatedAt: "2026-06-08",
  groups: [
    {
      name: "Grupo Exemplo",
      teams: [
        { name: "Selecao Exemplo 1", code: "EX1", flagUrl: null },
        { name: "Selecao Exemplo 2", code: "EX2", flagUrl: null },
        { name: "Selecao Exemplo 3", code: "EX3", flagUrl: null },
        { name: "Selecao Exemplo 4", code: "EX4", flagUrl: null },
      ],
      matches: [
        {
          fifaMatchNumber: 1,
          roundNumber: 1,
          homeTeamCode: "EX1",
          awayTeamCode: "EX2",
          kickoffAt: "2026-06-11T00:00:00Z",
          stadium: "Estadio exemplo",
          city: "Cidade exemplo",
          country: "Pais exemplo",
        },
      ],
    },
  ],
};
