import type {
  KnockoutBracketMatch,
  KnockoutMatch,
  KnockoutPick,
  KnockoutRound,
  KnockoutRoundState,
  KnockoutSlot,
} from "./types";
export {
  KNOCKOUT_ROUND_LABELS,
  KNOCKOUT_ROUND_MATCH_COUNTS,
  KNOCKOUT_ROUNDS,
  KNOCKOUT_TOURNAMENT_KEY,
} from "./bracketStructure";
import {
  calculateKnockoutMatchScore,
  getKnockoutMatchPotentialPoints,
  KNOCKOUT_BASE_POINTS,
} from "./scoreBracket";
import {
  KNOCKOUT_ROUND_MATCH_COUNTS,
  KNOCKOUT_ROUNDS,
} from "./bracketStructure";

export function pickKey(round: KnockoutRound, position: number) {
  return `${round}:${position}`;
}

export function buildPickMap(picks: KnockoutPick[]) {
  return new Map(
    picks.map((pick) => [pickKey(pick.round, pick.position), pick]),
  );
}

function officialMatchMap(matches: KnockoutMatch[]) {
  return new Map(
    matches.map((match) => [pickKey(match.round, match.position), match]),
  );
}

function placeholder() {
  return "A definir";
}

function isConcreteSide(
  team: string | null | undefined,
  source: string | null | undefined,
) {
  return Boolean(team?.trim()) && !source?.trim();
}

function slot(
  team: string | null | undefined,
  code: string | null | undefined,
  flagUrl: string | null | undefined,
  label: string,
): KnockoutSlot {
  return {
    team: team?.trim() || null,
    code: code?.trim() || null,
    flagUrl: flagUrl?.trim() || null,
    label,
  };
}

export function availableTeamsForMatch(
  round: KnockoutRound,
  position: number,
  matches: KnockoutMatch[],
) {
  if (round === "champion") {
    return [];
  }

  const matchByKey = officialMatchMap(matches);
  const match = matchByKey.get(pickKey(round, position));

  if (
    !match ||
    !isConcreteSide(match.teamA, match.teamASource) ||
    !isConcreteSide(match.teamB, match.teamBSource)
  ) {
    return [];
  }

  return [match.teamA, match.teamB].filter(
    (team): team is string => Boolean(team?.trim()),
  );
}

function buildBracketMatch(input: {
  round: KnockoutRound;
  position: number;
  matches: KnockoutMatch[];
  picks: KnockoutPick[];
}): KnockoutBracketMatch {
  const { round, position, matches, picks } = input;
  const matchByKey = officialMatchMap(matches);
  const pickByKey = buildPickMap(picks);
  const official = matchByKey.get(pickKey(round, position));
  const teams = availableTeamsForMatch(round, position, matches);
  const savedPick =
    pickByKey.get(pickKey(round, position))?.selectedTeam ??
    official?.userPick ??
    null;
  const selectedTeam =
    savedPick && teams.includes(savedPick) ? savedPick : null;
  const invalidSelectedTeam =
    savedPick && !teams.includes(savedPick) ? savedPick : null;
  const teamA = isConcreteSide(official?.teamA, official?.teamASource)
    ? official?.teamA
    : null;
  const teamB = isConcreteSide(official?.teamB, official?.teamBSource)
    ? official?.teamB
    : null;
  const pointsInfo = official
    ? getKnockoutMatchPotentialPoints(official, matches, picks)
    : {
        basePoints: KNOCKOUT_BASE_POINTS,
        bonusPoints: 0,
        totalPossiblePoints: KNOCKOUT_BASE_POINTS,
        bonusAvailable: false,
        bonusPending: false,
        bonusBlockedReason: null,
        ancestorMatchesCount: 0,
        correctAncestorMatchesCount: 0,
        pendingAncestorMatchesCount: 0,
      };
  const matchScore = official
    ? calculateKnockoutMatchScore(official, matches, picks)
    : null;

  return {
    id: official?.id ?? null,
    round,
    position,
    teamA: slot(
      teamA,
      teamA ? official?.teamACode : null,
      teamA ? official?.teamAFlagUrl : null,
      teamA ?? placeholder(),
    ),
    teamB: slot(
      teamB,
      teamB ? official?.teamBCode : null,
      teamB ? official?.teamBFlagUrl : null,
      teamB ?? placeholder(),
    ),
    startsAt: official?.startsAt ?? null,
    lockAt: official?.lockAt ?? null,
    statusShort: official?.statusShort ?? null,
    statusLong: official?.statusLong ?? null,
    elapsed: official?.elapsed ?? null,
    homeScoreLive: official?.homeScoreLive ?? null,
    awayScoreLive: official?.awayScoreLive ?? null,
    homeScore: official?.homeScore ?? null,
    awayScore: official?.awayScore ?? null,
    scoreUpdatedAt: official?.scoreUpdatedAt ?? null,
    isLocked: official?.isLocked ?? true,
    canPick: official?.canPick ?? false,
    pointsIfCorrect: pointsInfo.totalPossiblePoints,
    isFinished: official?.isFinished ?? false,
    isPickCorrect: official?.isPickCorrect ?? null,
    pickPoints: matchScore?.totalPoints ?? 0,
    winnerTeam: official?.winnerTeam ?? null,
    selectedTeam,
    invalidSelectedTeam,
    pointsInfo,
  };
}

export function buildBracket(
  matches: KnockoutMatch[],
  picks: KnockoutPick[],
): KnockoutRoundState[] {
  return KNOCKOUT_ROUNDS.map((round) => ({
    round,
    matches: Array.from(
      { length: KNOCKOUT_ROUND_MATCH_COUNTS[round] },
      (_, index) =>
        buildBracketMatch({
          round,
          position: index + 1,
          matches,
          picks,
        }),
    ),
  }));
}

export function championFromPicks(picks: KnockoutPick[]) {
  return buildPickMap(picks).get(pickKey("final", 1))?.selectedTeam ?? null;
}
