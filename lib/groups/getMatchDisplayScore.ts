import {
  isFinalMatchStatus,
  isHalftimeStatus,
  isLiveMatchStatus,
} from "@/lib/scores/liveScoreStatus";
import type { MatchWithTeams } from "@/types/match";

export function getMatchDisplayScore(match: MatchWithTeams) {
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
