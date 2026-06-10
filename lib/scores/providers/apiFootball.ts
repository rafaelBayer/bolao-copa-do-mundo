import type { FetchLiveScoresInput, LiveScoreFixture } from "./types";

const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";
const DEFAULT_WORLD_CUP_LEAGUE_ID = "1";
const DEFAULT_WORLD_CUP_SEASON = "2026";

type ApiFootballFixtureResponse = {
  fixture?: {
    id?: number;
    date?: string | null;
    status?: {
      long?: string | null;
      short?: string | null;
      elapsed?: number | null;
    } | null;
  } | null;
  teams?: {
    home?: {
      name?: string | null;
    } | null;
    away?: {
      name?: string | null;
    } | null;
  } | null;
  goals?: {
    home?: number | null;
    away?: number | null;
  } | null;
};

type ApiFootballResponse = {
  errors?: unknown;
  response?: ApiFootballFixtureResponse[];
};

function hasApiErrors(errors: unknown) {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === "object") return Object.keys(errors).length > 0;
  return true;
}

function optionalEnv(name: string, fallback: string) {
  const value = process.env[name]?.trim();

  return value || fallback;
}

function mapFixture(fixture: ApiFootballFixtureResponse): LiveScoreFixture | null {
  const fixtureId = fixture.fixture?.id;

  if (typeof fixtureId !== "number") {
    return null;
  }

  return {
    provider: "api-football",
    providerFixtureId: fixtureId,
    utcDate: fixture.fixture?.date ?? null,
    statusShort: fixture.fixture?.status?.short ?? null,
    statusLong: fixture.fixture?.status?.long ?? null,
    elapsed:
      typeof fixture.fixture?.status?.elapsed === "number"
        ? fixture.fixture.status.elapsed
        : null,
    homeTeamName: fixture.teams?.home?.name ?? null,
    awayTeamName: fixture.teams?.away?.name ?? null,
    homeScore:
      typeof fixture.goals?.home === "number" ? fixture.goals.home : null,
    awayScore:
      typeof fixture.goals?.away === "number" ? fixture.goals.away : null,
  };
}

async function fetchApiFootballFixtures(url: URL) {
  const apiKey = process.env.API_FOOTBALL_KEY;

  if (!apiKey) {
    throw new Error("Missing API_FOOTBALL_KEY.");
  }

  const response = await fetch(url, {
    headers: {
      "x-apisports-key": apiKey,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API-Football request failed: ${response.status}`);
  }

  const payload = (await response.json()) as ApiFootballResponse;

  if (hasApiErrors(payload.errors)) {
    throw new Error(
      `API-Football returned errors: ${JSON.stringify(payload.errors)}`,
    );
  }

  return (payload.response ?? [])
    .map(mapFixture)
    .filter((fixture): fixture is LiveScoreFixture => Boolean(fixture));
}

export async function fetchApiFootballFixturesByDate({
  date,
  timezone,
}: FetchLiveScoresInput): Promise<LiveScoreFixture[]> {
  const url = new URL("/fixtures", API_FOOTBALL_BASE_URL);
  url.searchParams.set("date", date);
  url.searchParams.set("timezone", timezone);

  return fetchApiFootballFixtures(url);
}

export async function fetchApiFootballFixturesByCompetition() {
  const leagueId = optionalEnv(
    "API_FOOTBALL_WORLD_CUP_LEAGUE_ID",
    DEFAULT_WORLD_CUP_LEAGUE_ID,
  );
  const season = optionalEnv(
    "API_FOOTBALL_WORLD_CUP_SEASON",
    DEFAULT_WORLD_CUP_SEASON,
  );
  const url = new URL("/fixtures", API_FOOTBALL_BASE_URL);
  url.searchParams.set("league", leagueId);
  url.searchParams.set("season", season);

  return fetchApiFootballFixtures(url);
}
