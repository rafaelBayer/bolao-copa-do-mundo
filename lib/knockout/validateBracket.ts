import {
  KNOCKOUT_ROUND_MATCH_COUNTS,
  KNOCKOUT_ROUNDS,
  availableTeamsForMatch,
  buildPickMap,
  pickKey,
} from "./buildBracket";
import type { KnockoutMatch, KnockoutPick, KnockoutRound } from "./types";

export type KnockoutValidationResult = {
  isValid: boolean;
  message: string | null;
  picks: KnockoutPick[];
};

function normalizedPick(pick: KnockoutPick | undefined): KnockoutPick | null {
  if (!pick) {
    return null;
  }

  const selectedTeam = pick.selectedTeam.trim();

  if (!selectedTeam) {
    return null;
  }

  return {
    ...pick,
    selectedTeam,
  };
}

export function pruneInvalidKnockoutPicks(
  matches: KnockoutMatch[],
  picks: KnockoutPick[],
) {
  const nextPicks: KnockoutPick[] = [];

  KNOCKOUT_ROUNDS.forEach((round) => {
    const pickByKey = buildPickMap(picks);

    for (let position = 1; position <= KNOCKOUT_ROUND_MATCH_COUNTS[round]; position += 1) {
      const pick = normalizedPick(pickByKey.get(pickKey(round, position)));

      if (!pick) {
        continue;
      }

      const availableTeams = availableTeamsForMatch(
        round,
        position,
        matches,
        nextPicks,
      );

      if (availableTeams.includes(pick.selectedTeam)) {
        nextPicks.push(pick);
      }
    }
  });

  const finalPick = nextPicks.find(
    (pick) => pick.round === "final" && pick.position === 1,
  );
  const championPick = picks.find(
    (pick) => pick.round === "champion" && pick.position === 1,
  );

  if (finalPick) {
    nextPicks.push({
      ...championPick,
      round: "champion",
      position: 1,
      selectedTeam: finalPick.selectedTeam,
    });
  }

  return nextPicks;
}

export function validateKnockoutBracket(
  matches: KnockoutMatch[],
  picks: KnockoutPick[],
): KnockoutValidationResult {
  const prunedPicks = pruneInvalidKnockoutPicks(matches, picks);
  const pickByKey = buildPickMap(prunedPicks);

  for (const round of [...KNOCKOUT_ROUNDS, "champion" as KnockoutRound]) {
    for (let position = 1; position <= KNOCKOUT_ROUND_MATCH_COUNTS[round]; position += 1) {
      if (!pickByKey.has(pickKey(round, position))) {
        return {
          isValid: false,
          message: "Preencha todos os confrontos ate o campeao.",
          picks: prunedPicks,
        };
      }
    }
  }

  return {
    isValid: true,
    message: null,
    picks: prunedPicks,
  };
}
