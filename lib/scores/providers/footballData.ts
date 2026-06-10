import type { LiveScoreFixture } from "./types";

const FOOTBALL_DATA_BASE_URL = "https://api.football-data.org/v4";
const DEFAULT_COMPETITION_CODE = "WC";

type FootballDataMatch = {
  id?: number;
  utcDate?: string | null;
  status?: string | null;
  minute?: number | null;
  homeTeam?: {
    name?: string | null;
  } | null;
  awayTeam?: {
    name?: string | null;
  } | null;
  score?: {
    fullTime?: {
      home?: number | null;
      away?: number | null;
    } | null;
    regularTime?: {
      home?: number | null;
      away?: number | null;
    } | null;
    halfTime?: {
      home?: number | null;
      away?: number | null;
    } | null;
  } | null;
};

type FootballDataResponse = {
  message?: string;
  errorCode?: number;
  count?: number;
  matches?: FootballDataMatch[];
};

function footballDataStatus(status: string | null | undefined) {
  switch (status) {
    case "IN_PLAY":
      return { short: "1H", long: "In Play" };
    case "PAUSED":
      return { short: "HT", long: "Paused" };
    case "FINISHED":
      return { short: "FT", long: "Match Finished" };
    case "TIMED":
    case "SCHEDULED":
      return { short: "NS", long: "Not Started" };
    case "POSTPONED":
      return { short: "PST", long: "Postponed" };
    case "SUSPENDED":
      return { short: "SUSP", long: "Suspended" };
    case "CANCELLED":
      return { short: "CANC", long: "Cancelled" };
    default:
      return { short: status ?? null, long: status ?? null };
  }
}

function scoreFromMatch(match: FootballDataMatch) {
  const score =
    match.score?.fullTime ??
    match.score?.regularTime ??
    match.score?.halfTime ??
    null;

  return {
    homeScore: typeof score?.home === "number" ? score.home : null,
    awayScore: typeof score?.away === "number" ? score.away : null,
  };
}

function mapMatch(match: FootballDataMatch): LiveScoreFixture | null {
  if (typeof match.id !== "number") {
    return null;
  }

  const status = footballDataStatus(match.status);
  const score = scoreFromMatch(match);

  return {
    provider: "football-data",
    providerFixtureId: String(match.id),
    utcDate: match.utcDate ?? null,
    statusShort: status.short,
    statusLong: status.long,
    elapsed: typeof match.minute === "number" ? match.minute : null,
    homeTeamName: match.homeTeam?.name ?? null,
    awayTeamName: match.awayTeam?.name ?? null,
    homeScore: score.homeScore,
    awayScore: score.awayScore,
  };
}

export async function fetchFootballDataMatches(): Promise<LiveScoreFixture[]> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    throw new Error("Missing FOOTBALL_DATA_API_KEY.");
  }

  const competitionCode =
    process.env.FOOTBALL_DATA_COMPETITION_CODE?.trim() ||
    DEFAULT_COMPETITION_CODE;
  const url = new URL(
    `/competitions/${competitionCode}/matches`,
    FOOTBALL_DATA_BASE_URL,
  );

  const response = await fetch(url, {
    headers: {
      "X-Auth-Token": apiKey,
    },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | FootballDataResponse
    | null;

  if (!response.ok) {
    throw new Error(
      `football-data request failed: ${response.status}${
        payload?.message ? ` - ${payload.message}` : ""
      }`,
    );
  }

  if (payload?.message && !payload.matches) {
    throw new Error(`football-data returned an error: ${payload.message}`);
  }

  return (payload?.matches ?? [])
    .map(mapMatch)
    .filter((fixture): fixture is LiveScoreFixture => Boolean(fixture));
}
