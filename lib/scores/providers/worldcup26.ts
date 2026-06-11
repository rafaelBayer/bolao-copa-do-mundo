import type { LiveScoreFixture } from "./types";

const DEFAULT_BASE_URL = "https://worldcup26.ir";

export type Worldcup26Game = {
  _id?: unknown;
  id?: unknown;
  group?: unknown;
  matchday?: unknown;
  home_team_name_en?: unknown;
  away_team_name_en?: unknown;
  home_score?: unknown;
  away_score?: unknown;
  finished?: unknown;
  time_elapsed?: unknown;
  date?: unknown;
  start_time?: unknown;
};

type Worldcup26Payload = {
  games?: unknown;
  game?: unknown;
  response?: {
    games?: unknown;
    game?: unknown;
  };
};

export function worldcup26BaseUrl() {
  const configuredUrl =
    process.env.WORLDCUP26_API_BASE_URL?.trim() ||
    process.env.LOCAL_SCORE_API_URL?.trim() ||
    DEFAULT_BASE_URL;
  const url = configuredUrl.replace(/\/+$/, "");

  return url.replace(/\/get\/games$/i, "");
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : null;
}

function parseScore(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number.parseInt(value.trim(), 10);

  return Number.isInteger(parsed) ? parsed : null;
}

function parseFinished(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }

  return false;
}

const TEAM_ALIASES = new Map<string, string>([
  ["africa do sul", "south africa"],
  ["alemanha", "germany"],
  ["argelia", "algeria"],
  ["arabia saudita", "saudi arabia"],
  ["australia", "australia"],
  ["austria", "austria"],
  ["belgica", "belgium"],
  ["bosnia e herzegovina", "bosnia and herzegovina"],
  ["brasil", "brazil"],
  ["cabo verde", "cape verde"],
  ["canada", "canada"],
  ["catar", "qatar"],
  ["colombia", "colombia"],
  ["coreia do sul", "south korea"],
  ["costa do marfim", "ivory coast"],
  ["croacia", "croatia"],
  ["curacao", "curacao"],
  ["egito", "egypt"],
  ["equador", "ecuador"],
  ["escocia", "scotland"],
  ["espanha", "spain"],
  ["estados unidos", "united states"],
  ["franca", "france"],
  ["gana", "ghana"],
  ["haiti", "haiti"],
  ["inglaterra", "england"],
  ["ira", "iran"],
  ["iran", "iran"],
  ["iraque", "iraq"],
  ["japao", "japan"],
  ["jordania", "jordan"],
  ["marrocos", "morocco"],
  ["mexico", "mexico"],
  ["noruega", "norway"],
  ["nova zelandia", "new zealand"],
  ["paises baixos", "netherlands"],
  ["panama", "panama"],
  ["paraguai", "paraguay"],
  ["portugal", "portugal"],
  ["rd congo", "democratic republic of the congo"],
  ["republica democratica do congo", "democratic republic of the congo"],
  ["republica tcheca", "czech republic"],
  ["senegal", "senegal"],
  ["suecia", "sweden"],
  ["suica", "switzerland"],
  ["tunisia", "tunisia"],
  ["turquia", "turkey"],
  ["uruguai", "uruguay"],
  ["uzbequistao", "uzbekistan"],
]);

export function normalizeWorldcup26TeamName(value: string | null | undefined) {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  return TEAM_ALIASES.get(normalized) ?? normalized;
}

export function worldcup26TeamsMatch(input: {
  localHomeName: string | null | undefined;
  localAwayName: string | null | undefined;
  providerHomeName: string | null | undefined;
  providerAwayName: string | null | undefined;
}) {
  return (
    normalizeWorldcup26TeamName(input.localHomeName) ===
      normalizeWorldcup26TeamName(input.providerHomeName) &&
    normalizeWorldcup26TeamName(input.localAwayName) ===
      normalizeWorldcup26TeamName(input.providerAwayName)
  );
}

function gamesFromPayload(payload: Worldcup26Payload | null) {
  const topLevelGames = payload?.games;

  if (Array.isArray(topLevelGames)) {
    return topLevelGames as Worldcup26Game[];
  }

  const responseGames = payload?.response?.games;

  if (Array.isArray(responseGames)) {
    return responseGames as Worldcup26Game[];
  }

  return [];
}

function gameFromPayload(payload: Worldcup26Payload | null) {
  const topLevelGame = payload?.game;

  if (topLevelGame && typeof topLevelGame === "object") {
    return topLevelGame as Worldcup26Game;
  }

  const responseGame = payload?.response?.game;

  if (responseGame && typeof responseGame === "object") {
    return responseGame as Worldcup26Game;
  }

  if (payload && !Array.isArray(payload) && typeof payload === "object") {
    const maybeGame = payload as Worldcup26Game;

    if (maybeGame._id || maybeGame.home_team_name_en) {
      return maybeGame;
    }
  }

  return null;
}

async function fetchWorldcup26Json(path: string) {
  const response = await fetch(`${worldcup26BaseUrl()}${path}`, {
    headers: {
      accept: "application/json",
    },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | Worldcup26Payload
    | null;

  if (!response.ok) {
    throw new Error(`worldcup26 request failed: HTTP ${response.status}`);
  }

  return payload;
}

export async function fetchWorldcup26Games() {
  const payload = await fetchWorldcup26Json("/get/games");

  return gamesFromPayload(payload);
}

export async function fetchWorldcup26GameByMongoId(gameId: string) {
  if (!gameId.trim()) {
    throw new Error("Missing worldcup26 game id.");
  }

  const payload = await fetchWorldcup26Json(
    `/get/game/${encodeURIComponent(gameId.trim())}`,
  );
  const game = gameFromPayload(payload);

  if (!game) {
    throw new Error(`worldcup26 game not found: ${gameId}`);
  }

  return game;
}

export function mapWorldcup26GameToInternalScore(
  game: Worldcup26Game,
  fallback?: {
    homeTeamName?: string | null;
    awayTeamName?: string | null;
  },
): LiveScoreFixture | null {
  const providerFixtureId = stringValue(game._id);
  const homeTeamName =
    stringValue(game.home_team_name_en) ?? fallback?.homeTeamName ?? null;
  const awayTeamName =
    stringValue(game.away_team_name_en) ?? fallback?.awayTeamName ?? null;
  const homeScore = parseScore(game.home_score);
  const awayScore = parseScore(game.away_score);
  const timeElapsed = stringValue(game.time_elapsed)?.toLowerCase() ?? "";
  const finished = parseFinished(game.finished) || timeElapsed === "finished";
  const elapsed = parseScore(timeElapsed);

  if (!providerFixtureId || !homeTeamName || !awayTeamName) {
    return null;
  }

  if (homeScore === null || awayScore === null) {
    return null;
  }

  return {
    provider: "worldcup26",
    providerFixtureId,
    statusShort:
      timeElapsed === "notstarted" ? "NS" : finished ? "FT" : "LIVE",
    statusLong:
      timeElapsed === "notstarted"
        ? "Not Started"
        : finished
          ? "Match Finished"
          : "Live",
    elapsed,
    homeTeamName,
    awayTeamName,
    homeScore,
    awayScore,
  };
}
