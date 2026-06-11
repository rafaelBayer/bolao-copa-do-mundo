import type { LiveScoreFixture } from "./types";

const DEFAULT_FOOTBALL_DATA_BASE_URL = "https://api.football-data.org/v4";
const DEFAULT_COMPETITION_CODE = "WC";

type FootballDataMatch = {
  id?: number;
  utcDate?: string | null;
  status?: string | null;
  minute?: number | null;
  matchday?: number | null;
  homeTeam?: {
    name?: string | null;
    shortName?: string | null;
    tla?: string | null;
  } | null;
  awayTeam?: {
    name?: string | null;
    shortName?: string | null;
    tla?: string | null;
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

function competitionCode() {
  return (
    process.env.FOOTBALL_DATA_COMPETITION_CODE?.trim() ||
    DEFAULT_COMPETITION_CODE
  );
}

function baseUrl() {
  return (
    process.env.FOOTBALL_DATA_BASE_URL?.trim() ||
    DEFAULT_FOOTBALL_DATA_BASE_URL
  ).replace(/\/+$/, "");
}

function footballDataStatus(status: string | null | undefined) {
  switch (status) {
    case "IN_PLAY":
    case "LIVE":
      return { short: "LIVE", long: "Live" };
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

function completeScore(
  score: { home?: number | null; away?: number | null } | null | undefined,
) {
  if (typeof score?.home !== "number" || typeof score.away !== "number") {
    return null;
  }

  return {
    homeScore: score.home,
    awayScore: score.away,
  };
}

function scoreFromMatch(match: FootballDataMatch) {
  const score =
    completeScore(match.score?.fullTime) ??
    completeScore(match.score?.regularTime) ??
    (match.status === "PAUSED" ? completeScore(match.score?.halfTime) : null) ??
    completeScore(match.score?.halfTime);

  return score ?? { homeScore: null, awayScore: null };
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
    matchday:
      typeof match.matchday === "number" ? match.matchday : null,
    statusShort: status.short,
    statusLong: status.long,
    elapsed: typeof match.minute === "number" ? match.minute : null,
    homeTeamName: match.homeTeam?.name ?? null,
    homeTeamCode: match.homeTeam?.tla ?? null,
    awayTeamName: match.awayTeam?.name ?? null,
    awayTeamCode: match.awayTeam?.tla ?? null,
    homeScore: score.homeScore,
    awayScore: score.awayScore,
  };
}

function endpointPath(matchday: number) {
  return `/competitions/${competitionCode()}/matches?matchday=${matchday}`;
}

function fullEndpointPath(matchday: number) {
  const basePath = new URL(baseUrl()).pathname.replace(/\/+$/, "");

  return `${basePath}${endpointPath(matchday)}`;
}

export async function fetchFootballDataMatchesByMatchday(
  matchday: number,
): Promise<LiveScoreFixture[]> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    throw new Error("Missing FOOTBALL_DATA_API_KEY.");
  }

  if (!Number.isInteger(matchday) || matchday <= 0) {
    throw new Error(`Invalid football-data matchday: ${matchday}`);
  }

  const path = endpointPath(matchday);
  const url = new URL(`${baseUrl()}${path}`);

  console.log(`football-data provider: competition=${competitionCode()}`);
  console.log(`football-data base URL: ${baseUrl()}`);
  console.log(`football-data request: GET ${fullEndpointPath(matchday)}`);

  const response = await fetch(url, {
    headers: {
      "X-Auth-Token": apiKey,
    },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | FootballDataResponse
    | null;

  console.log(`football-data response: HTTP ${response.status}`);

  if (!response.ok) {
    throw new Error(
      `football-data request failed: HTTP ${response.status} - ${JSON.stringify(
        payload ?? {},
      )}`,
    );
  }

  if (payload?.message && !payload.matches) {
    throw new Error(
      `football-data returned an error: ${JSON.stringify(payload)}`,
    );
  }

  const fixtures = (payload?.matches ?? [])
    .map(mapMatch)
    .filter((fixture): fixture is LiveScoreFixture => Boolean(fixture));

  console.log(`football-data matchday ${matchday}: ${fixtures.length} fixtures`);

  return fixtures;
}

export async function fetchFootballDataMatchesByMatchdays(
  matchdays: number[],
): Promise<LiveScoreFixture[]> {
  const uniqueMatchdays = Array.from(new Set(matchdays))
    .filter((matchday) => Number.isInteger(matchday) && matchday > 0)
    .sort((first, second) => first - second);
  const fixtures: LiveScoreFixture[] = [];

  for (const matchday of uniqueMatchdays) {
    fixtures.push(...(await fetchFootballDataMatchesByMatchday(matchday)));
  }

  return fixtures;
}

export async function fetchFootballDataMatches(): Promise<LiveScoreFixture[]> {
  return fetchFootballDataMatchesByMatchdays([1, 2, 3]);
}
