import type {
  KnockoutBracketMatch,
  KnockoutMatch,
  KnockoutPick,
  KnockoutRound,
  KnockoutRoundState,
  KnockoutSlot,
} from "./types";

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
  champion: "Campeao",
};

export const KNOCKOUT_ROUND_MATCH_COUNTS: Record<KnockoutRound, number> = {
  round_of_32: 16,
  round_of_16: 8,
  quarterfinal: 4,
  semifinal: 2,
  final: 1,
  champion: 1,
};

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

function placeholder(round: KnockoutRound, position: number, side: "a" | "b") {
  if (round === "round_of_32") {
    return "A definir";
  }

  const sourcePosition = position * 2 - (side === "a" ? 1 : 0);
  return `Vencedor ${sourcePosition}`;
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

function teamMetaForPick(team: string | null, matches: KnockoutMatch[]) {
  if (!team) {
    return {
      code: null,
      flagUrl: null,
    };
  }

  for (const match of matches) {
    if (match.teamA === team) {
      return {
        code: match.teamACode,
        flagUrl: match.teamAFlagUrl,
      };
    }

    if (match.teamB === team) {
      return {
        code: match.teamBCode,
        flagUrl: match.teamBFlagUrl,
      };
    }
  }

  return {
    code: null,
    flagUrl: null,
  };
}

export function availableTeamsForMatch(
  round: KnockoutRound,
  position: number,
  matches: KnockoutMatch[],
  picks: KnockoutPick[],
) {
  if (round === "champion") {
    const finalPick = buildPickMap(picks).get(pickKey("final", 1));
    return finalPick ? [finalPick.selectedTeam] : [];
  }

  const matchByKey = officialMatchMap(matches);
  const pickByKey = buildPickMap(picks);

  if (round === "round_of_32") {
    const match = matchByKey.get(pickKey(round, position));
    return [match?.teamA, match?.teamB].filter(
      (team): team is string => Boolean(team?.trim()),
    );
  }

  const previousRound = previousRoundFor(round);

  if (!previousRound) {
    return [];
  }

  const firstSource = pickByKey.get(pickKey(previousRound, position * 2 - 1));
  const secondSource = pickByKey.get(pickKey(previousRound, position * 2));

  return [firstSource?.selectedTeam, secondSource?.selectedTeam].filter(
    (team): team is string => Boolean(team),
  );
}

function previousRoundFor(round: KnockoutRound): KnockoutRound | null {
  switch (round) {
    case "round_of_16":
      return "round_of_32";
    case "quarterfinal":
      return "round_of_16";
    case "semifinal":
      return "quarterfinal";
    case "final":
      return "semifinal";
    default:
      return null;
  }
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
  const teams = availableTeamsForMatch(round, position, matches, picks);
  const selectedTeam = pickByKey.get(pickKey(round, position))?.selectedTeam ?? null;

  if (round === "round_of_32") {
    return {
      round,
      position,
      teamA: slot(
        official?.teamA,
        official?.teamACode,
        official?.teamAFlagUrl,
        official?.teamA ?? placeholder(round, position, "a"),
      ),
      teamB: slot(
        official?.teamB,
        official?.teamBCode,
        official?.teamBFlagUrl,
        official?.teamB ?? placeholder(round, position, "b"),
      ),
      startsAt: official?.startsAt ?? null,
      winnerTeam: official?.winnerTeam ?? null,
      selectedTeam,
    };
  }

  const teamAMeta = teamMetaForPick(teams[0] ?? null, matches);
  const teamBMeta = teamMetaForPick(teams[1] ?? null, matches);

  return {
    round,
    position,
    teamA: slot(
      teams[0],
      teamAMeta.code,
      teamAMeta.flagUrl,
      teams[0] ?? placeholder(round, position, "a"),
    ),
    teamB: slot(
      teams[1],
      teamBMeta.code,
      teamBMeta.flagUrl,
      teams[1] ?? placeholder(round, position, "b"),
    ),
    startsAt: official?.startsAt ?? null,
    winnerTeam: official?.winnerTeam ?? null,
    selectedTeam,
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
