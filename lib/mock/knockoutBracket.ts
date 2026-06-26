import { KNOCKOUT_TOURNAMENT_KEY } from "@/lib/knockout/buildBracket";
import type {
  KnockoutMatch,
  KnockoutPick,
  KnockoutRankingEntry,
  KnockoutSettings,
  UserKnockoutBracket,
} from "@/lib/knockout/types";

// Mock temporario para desenvolvimento local da tela de mata-mata.
// Remover/substituir pelos dados reais antes da finalizacao.

const mockStartsAt = "2026-06-28T16:00:00-03:00";

function roundOf32Match(
  position: number,
  teamA: string | null,
  teamB: string | null,
  startsAt: string | null = mockStartsAt,
): KnockoutMatch {
  return {
    id: `mock-r32-${position}`,
    tournamentKey: KNOCKOUT_TOURNAMENT_KEY,
    round: "round_of_32",
    position,
    teamA,
    teamB,
    startsAt,
    winnerTeam: null,
  };
}

export const knockoutBracketMock: {
  settings: KnockoutSettings;
  matches: KnockoutMatch[];
  bracket: UserKnockoutBracket | null;
  picks: KnockoutPick[];
  rankingEntries: KnockoutRankingEntry[];
  isLocked: boolean;
} = {
  settings: {
    id: "mock-knockout-settings",
    tournamentKey: KNOCKOUT_TOURNAMENT_KEY,
    name: "Copa do Mundo 2026",
    deadlineAt: mockStartsAt,
    isActive: true,
  },
  matches: [
    roundOf32Match(1, "Brasil", "Japao"),
    roundOf32Match(2, "Alemanha", null),
    roundOf32Match(3, "Mexico", null),
    roundOf32Match(4, "Argentina", null),
    roundOf32Match(5, "Franca", "Noruega"),
    roundOf32Match(6, "Portugal", "Colombia"),
    roundOf32Match(7, "Inglaterra", "Croacia"),
    roundOf32Match(8, "Estados Unidos", "Bosnia"),
    roundOf32Match(9, "Espanha", "Uruguai"),
    roundOf32Match(10, "Italia", "Chile"),
    roundOf32Match(11, null, null, null),
    roundOf32Match(12, "Holanda", "Marrocos"),
    roundOf32Match(13, "Belgica", null),
    roundOf32Match(14, "Dinamarca", "Coreia do Sul"),
    roundOf32Match(15, "Suica", "Gana"),
    roundOf32Match(16, null, "Canada"),
  ],
  bracket: null,
  picks: [],
  rankingEntries: [
    {
      userId: "mock-user-1",
      name: "Teste local",
      username: "teste-local",
      avatarUrl: null,
      totalPoints: 0,
      correctPicks: 0,
      submittedAt: null,
    },
  ],
  isLocked: false,
};
