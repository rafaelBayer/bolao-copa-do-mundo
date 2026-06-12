import type { LiveScoreFixture } from "./types";

const DEFAULT_BASE_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";

export type EspnEvent = {
  id?: unknown;
  date?: unknown;
  name?: unknown;
  shortName?: unknown;
  status?: {
    type?: {
      id?: unknown;
      name?: unknown;
      state?: unknown;
      completed?: unknown;
      description?: unknown;
      detail?: unknown;
      shortDetail?: unknown;
    };
    displayClock?: unknown;
  };
  competitions?: EspnCompetition[];
};

type EspnCompetition = {
  competitors?: EspnCompetitor[];
  details?: EspnDetail[];
};

type EspnCompetitor = {
  id?: unknown;
  homeAway?: unknown;
  score?: unknown;
  winner?: unknown;
  team?: {
    id?: unknown;
    displayName?: unknown;
    name?: unknown;
    abbreviation?: unknown;
    shortDisplayName?: unknown;
  };
};

export type EspnDetail = {
  id?: unknown;
  type?: {
    id?: unknown;
    text?: unknown;
  };
  clock?: {
    value?: unknown;
    displayValue?: unknown;
  };
  team?: {
    id?: unknown;
    displayName?: unknown;
  };
  scoreValue?: unknown;
  scoringPlay?: unknown;
  penaltyKick?: unknown;
  ownGoal?: unknown;
  shootout?: unknown;
  athletesInvolved?: Array<{
    id?: unknown;
    displayName?: unknown;
    shortName?: unknown;
    fullName?: unknown;
    team?: {
      id?: unknown;
    };
  }>;
};

type EspnScoreboardPayload = {
  events?: unknown;
};

type EspnSummaryPayload = {
  header?: {
    competitions?: EspnCompetition[];
  } & EspnEvent;
};

export type EspnGoal = {
  providerEventId: string | null;
  minute: number | null;
  teamName: string | null;
  playerName: string | null;
  goalType: string | null;
  isPenalty: boolean;
  isOwnGoal: boolean;
  rawEvent: EspnDetail;
};

export function espnBaseUrl() {
  return (
    process.env.ESPN_SCOREBOARD_BASE_URL?.trim() || DEFAULT_BASE_URL
  ).replace(/\/+$/, "");
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : null;
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }

  return false;
}

function parseInteger(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number.parseInt(value.trim(), 10);

  return Number.isInteger(parsed) ? parsed : null;
}

function eventsFromPayload(payload: EspnScoreboardPayload | null) {
  return Array.isArray(payload?.events) ? (payload.events as EspnEvent[]) : [];
}

function eventFromSummaryPayload(payload: EspnSummaryPayload | null) {
  const header = payload?.header;

  if (!header) {
    return null;
  }

  return header as EspnEvent;
}

async function fetchEspnJson(path: string) {
  const response = await fetch(`${espnBaseUrl()}${path}`, {
    headers: {
      accept: "application/json",
    },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | EspnScoreboardPayload
    | EspnSummaryPayload
    | null;

  if (!response.ok) {
    throw new Error(`ESPN request failed: HTTP ${response.status}`);
  }

  return payload;
}

export async function fetchEspnScoreboardByDate(date?: string) {
  const query = date ? `?dates=${encodeURIComponent(date)}` : "";
  const payload = (await fetchEspnJson(`/scoreboard${query}`)) as
    | EspnScoreboardPayload
    | null;

  return eventsFromPayload(payload);
}

export async function fetchEspnSummaryByEventId(eventId: string) {
  if (!eventId.trim()) {
    throw new Error("Missing ESPN event id.");
  }

  const payload = (await fetchEspnJson(
    `/summary?event=${encodeURIComponent(eventId.trim())}`,
  )) as EspnSummaryPayload | null;
  const event = eventFromSummaryPayload(payload);

  if (!event) {
    throw new Error(`ESPN event not found: ${eventId}`);
  }

  return {
    ...event,
    id: stringValue(event.id) ?? eventId,
  };
}

export function normalizeEspnTeamName(value: string | null | undefined) {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  switch (normalized) {
    case "africa do sul":
      return "south africa";
    case "alemanha":
      return "germany";
    case "argelia":
      return "algeria";
    case "coreia do sul":
    case "korea republic":
      return "south korea";
    case "republica tcheca":
    case "czechia":
      return "czech republic";
    case "estados unidos":
    case "usa":
      return "united states";
    case "turquia":
    case "turkiye":
      return "turkey";
    case "costa do marfim":
    case "cote d ivoire":
      return "ivory coast";
    case "cabo verde":
      return "cape verde";
    case "arabia saudita":
      return "saudi arabia";
    case "australia":
      return "australia";
    case "austria":
      return "austria";
    case "belgica":
      return "belgium";
    case "bosnia e herzegovina":
    case "bosnia herzegovina":
      return "bosnia and herzegovina";
    case "brasil":
      return "brazil";
    case "canada":
      return "canada";
    case "catar":
      return "qatar";
    case "colombia":
      return "colombia";
    case "croacia":
      return "croatia";
    case "curacao":
      return "curacao";
    case "egito":
      return "egypt";
    case "equador":
      return "ecuador";
    case "escocia":
      return "scotland";
    case "espanha":
      return "spain";
    case "franca":
      return "france";
    case "gana":
      return "ghana";
    case "haiti":
      return "haiti";
    case "inglaterra":
      return "england";
    case "ira":
    case "iran":
      return "iran";
    case "iraque":
      return "iraq";
    case "japao":
      return "japan";
    case "jordania":
      return "jordan";
    case "marrocos":
      return "morocco";
    case "rd congo":
    case "republica democratica do congo":
    case "dr congo":
    case "congo dr":
      return "democratic republic of the congo";
    case "noruega":
      return "norway";
    case "nova zelandia":
      return "new zealand";
    case "paises baixos":
      return "netherlands";
    case "panama":
      return "panama";
    case "paraguai":
      return "paraguay";
    case "portugal":
      return "portugal";
    case "senegal":
      return "senegal";
    case "suecia":
      return "sweden";
    case "suica":
      return "switzerland";
    case "tunisia":
      return "tunisia";
    case "uruguai":
      return "uruguay";
    case "uzbequistao":
      return "uzbekistan";
    case "mexico":
      return "mexico";
    default:
      return normalized;
  }
}

export function espnTeamsMatch(input: {
  localHomeName: string | null | undefined;
  localAwayName: string | null | undefined;
  providerHomeName: string | null | undefined;
  providerAwayName: string | null | undefined;
}) {
  return (
    normalizeEspnTeamName(input.localHomeName) ===
      normalizeEspnTeamName(input.providerHomeName) &&
    normalizeEspnTeamName(input.localAwayName) ===
      normalizeEspnTeamName(input.providerAwayName)
  );
}

export function mapEspnStatusToInternalStatus(status: EspnEvent["status"]) {
  const type = status?.type;
  const rawValues = [
    stringValue(type?.name),
    stringValue(type?.state),
    stringValue(type?.description),
    stringValue(type?.detail),
    stringValue(type?.shortDetail),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const completed = booleanValue(type?.completed);

  if (completed || /full time|final|status_final|status_full_time/.test(rawValues)) {
    return { short: "FT", long: "Match Finished" };
  }

  if (/half/.test(rawValues)) {
    return { short: "HT", long: "Halftime" };
  }

  if (/postponed/.test(rawValues)) {
    return { short: "PST", long: "Postponed" };
  }

  if (/cancel/.test(rawValues)) {
    return { short: "CANC", long: "Cancelled" };
  }

  if (/in progress|live|status_in_progress|status_first_half|status_second_half/.test(rawValues)) {
    return { short: "LIVE", long: "Live" };
  }

  return { short: "NS", long: "Not Started" };
}

function teamName(competitor: EspnCompetitor | null | undefined) {
  return (
    stringValue(competitor?.team?.displayName) ??
    stringValue(competitor?.team?.name) ??
    stringValue(competitor?.team?.shortDisplayName)
  );
}

function competitionForEvent(event: EspnEvent) {
  return event.competitions?.[0] ?? null;
}

function homeAway(event: EspnEvent) {
  const competitors = competitionForEvent(event)?.competitors ?? [];
  const home = competitors.find(
    (competitor) => stringValue(competitor.homeAway) === "home",
  );
  const away = competitors.find(
    (competitor) => stringValue(competitor.homeAway) === "away",
  );

  return { home, away };
}

export function mapEspnEventToInternalMatch(
  event: EspnEvent,
): LiveScoreFixture | null {
  const eventId = stringValue(event.id);
  const { home, away } = homeAway(event);
  const homeTeamName = teamName(home);
  const awayTeamName = teamName(away);
  const homeScore = parseInteger(home?.score);
  const awayScore = parseInteger(away?.score);
  const status = mapEspnStatusToInternalStatus(event.status);
  const displayClock = stringValue(event.status?.displayClock);
  const elapsed = displayClock ? parseInteger(displayClock) : null;

  if (!eventId || !homeTeamName || !awayTeamName) {
    return null;
  }

  return {
    provider: "espn",
    providerFixtureId: eventId,
    utcDate: stringValue(event.date),
    statusShort: status.short,
    statusLong: status.long,
    elapsed,
    homeTeamName,
    homeTeamCode: stringValue(home?.team?.abbreviation),
    awayTeamName,
    awayTeamCode: stringValue(away?.team?.abbreviation),
    homeScore,
    awayScore,
  };
}

function minuteFromDetail(detail: EspnDetail) {
  const displayValue = stringValue(detail.clock?.displayValue);
  const fromDisplay = displayValue?.match(/(\d+)/)?.[1];

  if (fromDisplay) {
    return Number.parseInt(fromDisplay, 10);
  }

  const seconds = parseInteger(detail.clock?.value);

  return seconds === null ? null : Math.max(0, Math.ceil(seconds / 60));
}

export function extractEspnGoals(event: EspnEvent): EspnGoal[] {
  const competition = competitionForEvent(event);
  const { home, away } = homeAway(event);
  const teamNameById = new Map(
    [home, away]
      .filter((competitor): competitor is EspnCompetitor => Boolean(competitor))
      .map((competitor) => [
        stringValue(competitor.team?.id) ?? stringValue(competitor.id) ?? "",
        teamName(competitor),
      ]),
  );

  return (competition?.details ?? [])
    .filter((detail) => booleanValue(detail.scoringPlay))
    .map((detail) => {
      const teamId = stringValue(detail.team?.id);
      const athlete = detail.athletesInvolved?.[0];

        return {
          providerEventId: stringValue(detail.id),
          minute: minuteFromDetail(detail),
          teamName:
            (teamId ? teamNameById.get(teamId) : null) ??
            stringValue(detail.team?.displayName),
        playerName:
          stringValue(athlete?.displayName) ??
          stringValue(athlete?.shortName) ??
          stringValue(athlete?.fullName),
        goalType: stringValue(detail.type?.text),
        isPenalty: booleanValue(detail.penaltyKick),
        isOwnGoal: booleanValue(detail.ownGoal),
        rawEvent: detail,
      };
    });
}
