import type { KnockoutRound } from "./types";

export const KNOCKOUT_TOURNAMENT_KEY = "world_cup_2026";

export const KNOCKOUT_ROUNDS: KnockoutRound[] = [
  "round_of_32",
  "round_of_16",
  "quarterfinal",
  "semifinal",
  "final",
];

export const KNOCKOUT_ROUND_LABELS: Record<KnockoutRound, string> = {
  round_of_32: "16 avos",
  round_of_16: "Oitavas",
  quarterfinal: "Quartas",
  semifinal: "Semifinal",
  final: "Final",
  third_place: "3o lugar",
  champion: "Campeao",
};

export const KNOCKOUT_ROUND_MATCH_COUNTS: Record<KnockoutRound, number> = {
  round_of_32: 16,
  round_of_16: 8,
  quarterfinal: 4,
  semifinal: 2,
  final: 1,
  third_place: 1,
  champion: 1,
};

export const ROUND_OF_32_POSITIONS = Array.from(
  { length: KNOCKOUT_ROUND_MATCH_COUNTS.round_of_32 },
  (_, index) => index + 1,
);

export function nextRoundPosition(position: number) {
  return Math.ceil(position / 2);
}

export function sourcePositionsForNextRound(position: number) {
  return [position * 2 - 1, position * 2] as const;
}

export function expectedMatchCount(round: KnockoutRound) {
  return KNOCKOUT_ROUND_MATCH_COUNTS[round];
}
