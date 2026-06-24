import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  espnTeamsMatch,
  fetchEspnScoreboardByDate,
  mapEspnEventToInternalMatch,
  type EspnEvent,
} from "../lib/scores/providers/espn";
import { isFinalMatchStatus } from "../lib/scores/liveScoreStatus";
import {
  isScoreDryRunEnabled,
  logScoreSupabaseTarget,
  logScoreSupabaseTargets,
  resolveScoreSupabaseEnvs,
} from "../lib/scores/resolveScoreSupabaseEnv";

type ResultsDatabase = {
  public: {
    Tables: {
      matches: {
        Row: MatchRow;
        Insert: never;
        Update: MatchUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type MatchRow = {
  id: string;
  kickoff_at: string | null;
  round_number: number | null;
  home_score: number | null;
  away_score: number | null;
  status_short: string | null;
  status_long: string | null;
  score_provider: string | null;
  score_provider_fixture_id: string | null;
  home_team: {
    name: string;
    code: string | null;
  } | null;
  away_team: {
    name: string;
    code: string | null;
  } | null;
};

type MatchUpdate = {
  home_score: number;
  away_score: number;
  home_score_live: number;
  away_score_live: number;
  status_short: string;
  status_long: string | null;
  elapsed: number | null;
  score_updated_at: string;
  score_provider: string;
  score_provider_fixture_id: string;
};

type ResultsSupabaseClient = SupabaseClient<ResultsDatabase>;
const espnScoreboardCache = new Map<string, Promise<EspnEvent[]>>();

async function fetchCachedEspnScoreboardByDate(date: string) {
  const cachedEvents = espnScoreboardCache.get(date);

  if (cachedEvents) {
    console.log(`[cache] espn scoreboard: hit (${date})`);
    return cachedEvents;
  }

  console.log(`[cache] espn scoreboard: miss (${date})`);
  const eventsPromise = fetchEspnScoreboardByDate(date);

  espnScoreboardCache.set(date, eventsPromise);

  return eventsPromise;
}

function parseDateArg(name: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));

  return arg?.slice(prefix.length) ?? null;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function espnDatePart(date: Date) {
  return isoDate(date).replace(/-/g, "");
}

function dateRange(start: Date, end: Date) {
  const dayMs = 24 * 60 * 60 * 1000;
  const dates: string[] = [];
  const first = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  const last = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());

  for (let time = first; time <= last; time += dayMs) {
    dates.push(espnDatePart(new Date(time)));
  }

  return dates;
}

function candidateDates(matches: MatchRow[]) {
  const now = new Date();
  const fromArg = parseDateArg("from");
  const toArg = parseDateArg("to");
  const times = matches
    .map((match) => match.kickoff_at)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite)
    .filter((time) => time <= now.getTime() + 6 * 60 * 60 * 1000);

  if (fromArg || toArg) {
    const start = fromArg ? new Date(`${fromArg}T00:00:00.000Z`) : new Date(Math.min(...times));
    const end = toArg ? new Date(`${toArg}T00:00:00.000Z`) : now;

    return dateRange(start, end);
  }

  if (times.length === 0) {
    return [];
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const start = new Date(Math.min(...times) - dayMs);
  const end = new Date(Math.min(now.getTime() + dayMs, Math.max(...times) + dayMs));

  return dateRange(start, end);
}

async function fetchMatches(supabase: ResultsSupabaseClient) {
  const { data, error } = await supabase
    .from("matches")
    .select(
      `
      id,
      kickoff_at,
      round_number,
      home_score,
      away_score,
      status_short,
      status_long,
      score_provider,
      score_provider_fixture_id,
      home_team:teams!matches_home_team_id_fkey(name, code),
      away_team:teams!matches_away_team_id_fkey(name, code)
    `,
    )
    .not("kickoff_at", "is", null)
    .order("kickoff_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as MatchRow[];
}

function timeDistanceHours(match: MatchRow, event: EspnEvent) {
  const fixture = mapEspnEventToInternalMatch(event);

  if (!match.kickoff_at || !fixture?.utcDate) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(
    new Date(match.kickoff_at).getTime() - new Date(fixture.utcDate).getTime(),
  ) / 36e5;
}

function findCandidates(match: MatchRow, events: EspnEvent[]) {
  return events
    .map((event) => ({
      event,
      fixture: mapEspnEventToInternalMatch(event),
      hours: timeDistanceHours(match, event),
    }))
    .filter(({ fixture }) =>
      fixture
        ? espnTeamsMatch({
            localHomeName: match.home_team?.name,
            localAwayName: match.away_team?.name,
            providerHomeName: fixture.homeTeamName,
            providerAwayName: fixture.awayTeamName,
          })
        : false,
    )
    .sort((first, second) => first.hours - second.hours);
}

function hasSameResult(match: MatchRow, update: MatchUpdate) {
  return (
    match.home_score === update.home_score &&
    match.away_score === update.away_score &&
    match.status_short === update.status_short &&
    match.score_provider === update.score_provider &&
    match.score_provider_fixture_id === update.score_provider_fixture_id
  );
}

function matchLabel(match: MatchRow) {
  return `${match.home_team?.name ?? "Home"} x ${match.away_team?.name ?? "Away"}`;
}

async function main() {
  const dryRun = isScoreDryRunEnabled();
  const supabaseConfigs = resolveScoreSupabaseEnvs();

  logScoreSupabaseTargets("ESPN finished results sync multi-target run", supabaseConfigs, dryRun);

  for (const supabaseConfig of supabaseConfigs) {
    const startedAt = Date.now();
    logScoreSupabaseTarget("ESPN finished results sync", supabaseConfig, dryRun);

    const supabase = createClient<ResultsDatabase>(
      supabaseConfig.supabaseUrl,
      supabaseConfig.supabaseServiceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    console.log("Fetching local matches...");
    const matches = await fetchMatches(supabase);
    console.log(`Local matches: ${matches.length}`);

    const dates = candidateDates(matches);
    const eventById = new Map<string, EspnEvent>();

    console.log(`Fetching ESPN scoreboards for ${dates.length} dates...`);
    console.log(`Date range: ${dates.join(", ") || "none"}`);
    for (const date of dates) {
      const events = await fetchCachedEspnScoreboardByDate(date);

      events.forEach((event) => {
        const fixture = mapEspnEventToInternalMatch(event);

        if (fixture) {
          eventById.set(String(fixture.providerFixtureId), event);
        }
      });
    }

    const events = Array.from(eventById.values());
    console.log(`Unique ESPN events loaded: ${events.length}`);
    console.log(`Scoreboard cache entries: ${espnScoreboardCache.size}`);
    let finishedMatches = 0;
    let alreadyUpdated = 0;
    let updatedMatches = 0;
    let pendingMatches = 0;
    let ambiguousMatches = 0;

    for (const match of matches) {
      const candidates = findCandidates(match, events);
      const candidate = candidates.length === 1 ? candidates[0] : null;
      const fixture = candidate?.fixture ?? null;

      if (!fixture) {
        if (candidates.length > 1) {
          ambiguousMatches += 1;
          console.log(`Ambiguous: ${matchLabel(match)} - ${candidates.length} candidates`);
        } else {
          pendingMatches += 1;
        }

        continue;
      }

      if (
        !isFinalMatchStatus(fixture.statusShort) ||
        typeof fixture.homeScore !== "number" ||
        typeof fixture.awayScore !== "number"
      ) {
        continue;
      }

      finishedMatches += 1;

      const update: MatchUpdate = {
        home_score: fixture.homeScore,
        away_score: fixture.awayScore,
        home_score_live: fixture.homeScore,
        away_score_live: fixture.awayScore,
        status_short: fixture.statusShort ?? "FT",
        status_long: fixture.statusLong,
        elapsed: fixture.elapsed,
        score_updated_at: new Date().toISOString(),
        score_provider: "espn",
        score_provider_fixture_id: String(fixture.providerFixtureId),
      };

      if (hasSameResult(match, update)) {
        alreadyUpdated += 1;
        continue;
      }

      console.log(
        `${dryRun ? "Would update" : "Updating"}: ${matchLabel(match)} -> ${fixture.homeScore} x ${fixture.awayScore} (${fixture.statusShort})`,
      );

      if (!dryRun) {
        const { error } = await supabase
          .from("matches")
          .update(update)
          .eq("id", match.id);

        if (error) {
          throw error;
        }
      }

      updatedMatches += 1;
    }

    console.log("Done.");
    console.log(`Duration: ${Date.now() - startedAt}ms`);
    console.log(`Finished matches found: ${finishedMatches}`);
    console.log(`Already updated: ${alreadyUpdated}`);
    console.log(`Updated matches: ${updatedMatches}`);
    console.log(`Pending matches without ESPN match: ${pendingMatches}`);
    console.log(`Ambiguous matches: ${ambiguousMatches}`);

    if (dryRun) {
      console.log("Dry-run: no database changes applied.");
    }
  }
}

main().catch((error: unknown) => {
  console.error("ESPN finished results sync failed.");
  console.error(error);
  process.exitCode = 1;
});
