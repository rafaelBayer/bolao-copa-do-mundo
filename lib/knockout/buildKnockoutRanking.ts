import {
  KNOCKOUT_ROUNDS,
} from "./bracketStructure";
import { pickKey } from "./buildBracket";
import {
  calculateKnockoutMatchScore,
  scoreKnockoutBracket,
} from "./scoreBracket";
import type {
  KnockoutMatch,
  KnockoutPick,
  KnockoutRankingEntry,
  KnockoutRankingPickDetail,
} from "./types";

export type KnockoutRankingMember = {
  userId: string;
};

export type KnockoutRankingProfile = {
  id: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
};

export type KnockoutRankingBracket = {
  id: string;
  userId: string;
  submittedAt: string | null;
  completedAt: string | null;
};

export type KnockoutRankingPick = KnockoutPick & {
  bracketId: string;
};

function pickBelongsToAvailableMatch(
  match: KnockoutMatch | undefined,
  pick: KnockoutPick,
) {
  return Boolean(
    match &&
      KNOCKOUT_ROUNDS.includes(match.round) &&
      pick.selectedTeam &&
      (pick.selectedTeam === match.teamA || pick.selectedTeam === match.teamB),
  );
}

function canRevealPick(match: KnockoutMatch) {
  const lockAt = match.startsAt
    ? new Date(match.startsAt).getTime() - 10 * 60 * 1000
    : null;
  const isClosedByTime = lockAt !== null && Date.now() >= lockAt;

  return Boolean(
    match.winnerTeam ||
      match.isFinished ||
      isClosedByTime,
  );
}

function buildPickDetails(input: {
  picks: KnockoutRankingPick[];
  matches: KnockoutMatch[];
  matchByKey: Map<string, KnockoutMatch>;
}): KnockoutRankingPickDetail[] {
  return input.picks
    .map((pick) => {
      const match = input.matchByKey.get(pickKey(pick.round, pick.position));

      if (!pickBelongsToAvailableMatch(match, pick) || !match) {
        return null;
      }

      if (!canRevealPick(match)) {
        return null;
      }

      const score = calculateKnockoutMatchScore(match, input.matches, input.picks);

      return {
        round: pick.round,
        position: pick.position,
        teamA: match.teamA,
        teamB: match.teamB,
        selectedTeam: pick.selectedTeam,
        winnerTeam: match.winnerTeam,
        points: score.totalPoints,
        isCorrect: match.winnerTeam ? score.isCorrect : null,
      } satisfies KnockoutRankingPickDetail;
    })
    .filter((pick): pick is KnockoutRankingPickDetail => Boolean(pick))
    .sort((left, right) => {
      const leftRoundIndex = KNOCKOUT_ROUNDS.indexOf(left.round);
      const rightRoundIndex = KNOCKOUT_ROUNDS.indexOf(right.round);

      if (leftRoundIndex !== rightRoundIndex) {
        return leftRoundIndex - rightRoundIndex;
      }

      return left.position - right.position;
    });
}

export function buildKnockoutRanking(input: {
  members: KnockoutRankingMember[];
  profiles: KnockoutRankingProfile[];
  brackets: KnockoutRankingBracket[];
  picks: KnockoutRankingPick[];
  matches: KnockoutMatch[];
}): KnockoutRankingEntry[] {
  const profileByUserId = new Map(
    input.profiles.map((profile) => [profile.id, profile]),
  );
  const bracketByUserId = new Map(
    input.brackets.map((bracket) => [bracket.userId, bracket]),
  );
  const picksByBracketId = new Map<string, KnockoutRankingPick[]>();
  const matchByKey = new Map(
    input.matches.map((match) => [pickKey(match.round, match.position), match]),
  );

  input.picks.forEach((pick) => {
    const bracketPicks = picksByBracketId.get(pick.bracketId) ?? [];
    bracketPicks.push(pick);
    picksByBracketId.set(pick.bracketId, bracketPicks);
  });

  return input.members
    .map((member) => {
      const bracket = bracketByUserId.get(member.userId);
      const picks = bracket ? picksByBracketId.get(bracket.id) ?? [] : [];
      const score = scoreKnockoutBracket(input.matches, picks);
      const pickDetails = buildPickDetails({
        picks,
        matches: input.matches,
        matchByKey,
      });
      const validPicksCount = picks.filter((pick) =>
        pickBelongsToAvailableMatch(
          matchByKey.get(pickKey(pick.round, pick.position)),
          pick,
        ),
      ).length;
      const profile = profileByUserId.get(member.userId);
      const fallbackName = profile?.username ?? "Participante";

      return {
        userId: member.userId,
        name: profile?.name?.trim() || fallbackName,
        username: profile?.username ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        totalPoints: score.totalPoints,
        correctPicks: score.correctPicks,
        submittedAt: bracket?.submittedAt ?? null,
        completedAt: bracket?.completedAt ?? null,
        picksCount: validPicksCount,
        isComplete: validPicksCount >= KNOCKOUT_ROUNDS.reduce(
          (total, round) =>
            total +
            input.matches.filter((match) => match.round === round).length,
          0,
        ),
        roundOf32Points: score.breakdown.roundOf32,
        roundOf16Points: score.breakdown.roundOf16,
        quarterfinalPoints: score.breakdown.quarterfinal,
        semifinalPoints: score.breakdown.semifinal,
        finalPoints: score.breakdown.final,
        roundOf32Correct: score.correctBreakdown.roundOf32Correct,
        roundOf16Correct: score.correctBreakdown.roundOf16Correct,
        quarterfinalCorrect: score.correctBreakdown.quarterfinalCorrect,
        semifinalCorrect: score.correctBreakdown.semifinalCorrect,
        finalCorrect: score.correctBreakdown.finalCorrect,
        picks: pickDetails,
      } satisfies KnockoutRankingEntry;
    })
    .sort((left, right) => {
      if (right.totalPoints !== left.totalPoints) {
        return right.totalPoints - left.totalPoints;
      }

      if (right.correctPicks !== left.correctPicks) {
        return right.correctPicks - left.correctPicks;
      }

      if (left.submittedAt !== right.submittedAt) {
        if (!left.submittedAt) return 1;
        if (!right.submittedAt) return -1;
        return left.submittedAt.localeCompare(right.submittedAt);
      }

      return left.name.localeCompare(right.name, "pt-BR");
    });
}
