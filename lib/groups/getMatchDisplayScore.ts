import {
  isFinalMatchStatus,
  isHalftimeStatus,
  isLiveMatchStatus,
} from "@/lib/scores/liveScoreStatus";

type MatchDisplayScoreInput = {
  statusShort: string | null;
  homeScoreLive: number | null;
  awayScoreLive: number | null;
  homeScore: number | null;
  awayScore: number | null;
};

export function getMatchDisplayScore(match: MatchDisplayScoreInput) {
  if (
    isFinalMatchStatus(match.statusShort) &&
    match.homeScore !== null &&
    match.awayScore !== null
  ) {
    return {
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      source: "final" as const,
    };
  }

  if (
    (isLiveMatchStatus(match.statusShort) ||
      isHalftimeStatus(match.statusShort)) &&
    match.homeScoreLive !== null &&
    match.awayScoreLive !== null
  ) {
    return {
      homeScore: match.homeScoreLive,
      awayScore: match.awayScoreLive,
      source: "live" as const,
    };
  }

  if (match.homeScore !== null && match.awayScore !== null) {
    return {
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      source: "final" as const,
    };
  }

  return {
    homeScore: null,
    awayScore: null,
    source: "none" as const,
  };
}
