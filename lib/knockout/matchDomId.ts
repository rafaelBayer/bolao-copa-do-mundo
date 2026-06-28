import type { KnockoutRound } from "./types";

type KnockoutMatchDomTarget = {
  id: string | null;
  round: KnockoutRound;
  position: number;
};

export function knockoutMatchCardId(match: KnockoutMatchDomTarget) {
  return `knockout-match-card-${match.id ?? `${match.round}-${match.position}`}`;
}
