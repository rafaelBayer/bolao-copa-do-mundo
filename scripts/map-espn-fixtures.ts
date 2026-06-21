import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  espnTeamsMatch,
  fetchEspnScoreboardByDate,
  mapEspnEventToInternalMatch,
  type EspnEvent,
} from "../lib/scores/providers/espn";
import {
  getScriptSupabaseConfig,
  loadScriptEnvFiles,
  logScriptSupabaseTarget,
} from "../lib/supabase/scriptEnv";

type MappingDatabase = {
  public: {
    Tables: {
      matches: {
        Row: MatchRow;
        Insert: never;
        Update: {
          score_provider?: string | null;
          score_provider_fixture_id?: string | null;
        };
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
  score_provider: string | null;
  score_provider_fixture_id: string | null;
  group: {
    name: string;
  } | null;
  home_team: {
    name: string;
    code: string | null;
  } | null;
  away_team: {
    name: string;
    code: string | null;
  } | null;
};

type MappingSupabaseClient = SupabaseClient<MappingDatabase>;

async function fetchMatches(supabase: MappingSupabaseClient) {
  const { data, error } = await supabase
    .from("matches")
    .select(
      `
      id,
      kickoff_at,
      round_number,
      score_provider,
      score_provider_fixture_id,
      group:groups!matches_group_id_fkey(name),
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

function espnDatePart(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function dateRangeForMatches(matches: MatchRow[]) {
  const times = matches
    .map((match) => match.kickoff_at)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);

  if (times.length === 0) {
    return [];
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const start = Math.min(...times) - dayMs;
  const end = Math.max(...times) + dayMs;
  const dates: string[] = [];

  for (let time = start; time <= end; time += dayMs) {
    dates.push(espnDatePart(new Date(time)));
  }

  return Array.from(new Set(dates));
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

async function main() {
  loadScriptEnvFiles();

  const dryRun = process.argv.includes("--dry-run");
  const supabaseConfig = getScriptSupabaseConfig();
  logScriptSupabaseTarget("ESPN fixture mapping", supabaseConfig, dryRun);

  const supabase = createClient<MappingDatabase>(
    supabaseConfig.url,
    supabaseConfig.serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  console.log("Fetching local matches...");
  const matches = await fetchMatches(supabase);
  console.log(`Total local: ${matches.length}`);

  const dates = dateRangeForMatches(matches);
  const eventById = new Map<string, EspnEvent>();

  console.log(`Fetching ESPN scoreboards for ${dates.length} dates...`);
  for (const date of dates) {
    const events = await fetchEspnScoreboardByDate(date);

    events.forEach((event) => {
      const fixture = mapEspnEventToInternalMatch(event);

      if (fixture) {
        eventById.set(String(fixture.providerFixtureId), event);
      }
    });
  }

  const events = Array.from(eventById.values());
  console.log(`Total ESPN: ${events.length}`);

  let mappedBefore = 0;
  let mapped = 0;
  let alreadyMapped = 0;
  let updatedMatches = 0;
  let pending = 0;
  let ambiguous = 0;
  let conflicts = 0;
  const pendingLabels: string[] = [];
  const conflictLabels: string[] = [];

  for (const match of matches) {
    if (match.score_provider === "espn" && match.score_provider_fixture_id) {
      mappedBefore += 1;
    }

    const candidates = findCandidates(match, events);
    const candidate = candidates.length === 1 ? candidates[0] : null;
    const fixture = candidate?.fixture ?? null;

    if (!fixture) {
      if (candidates.length > 1) {
        ambiguous += 1;
        console.log(
          `Ambiguous: ${match.home_team?.name} x ${match.away_team?.name} - ${candidates.length} candidates`,
        );
      } else {
        pending += 1;
        pendingLabels.push(
          `${match.home_team?.name} x ${match.away_team?.name} (${match.group?.name ?? "sem grupo"}, rodada ${match.round_number ?? "-"})`,
        );
        console.log(
          `Pending: ${match.home_team?.name} x ${match.away_team?.name}`,
        );
      }

      continue;
    }

    mapped += 1;

    if (
      match.score_provider === "espn" &&
      match.score_provider_fixture_id &&
      match.score_provider_fixture_id !== String(fixture.providerFixtureId)
    ) {
      conflicts += 1;
      conflictLabels.push(
        `${match.home_team?.name} x ${match.away_team?.name}: local=${match.score_provider_fixture_id}, candidate=${fixture.providerFixtureId}`,
      );
      console.log(
        `Conflict: ${match.home_team?.name} x ${match.away_team?.name} is mapped to ${match.score_provider_fixture_id}, candidate is ${fixture.providerFixtureId}`,
      );
      continue;
    }

    if (
      match.score_provider === "espn" &&
      match.score_provider_fixture_id === String(fixture.providerFixtureId)
    ) {
      alreadyMapped += 1;
    }

    console.log(
      `${dryRun ? "Would map" : "Mapping"}: ${match.home_team?.name} x ${match.away_team?.name} -> espn:${fixture.providerFixtureId}`,
    );

    if (
      !dryRun &&
      (match.score_provider !== "espn" ||
        match.score_provider_fixture_id !== String(fixture.providerFixtureId))
    ) {
      const { error } = await supabase
        .from("matches")
        .update({
          score_provider: "espn",
          score_provider_fixture_id: String(fixture.providerFixtureId),
        })
        .eq("id", match.id);

      if (error) {
        throw error;
      }

      updatedMatches += 1;
    }
  }

  console.log("Done.");
  console.log(`Mapped before: ${mappedBefore}`);
  console.log(`Mapped: ${mapped}`);
  console.log(`Already mapped: ${alreadyMapped}`);
  console.log(`Updated matches: ${updatedMatches}`);
  console.log(`Pending: ${pending}`);
  console.log(`Ambiguous: ${ambiguous}`);
  console.log(`Conflicts: ${conflicts}`);

  if (pendingLabels.length > 0) {
    console.log("Pending matches:");
    pendingLabels.forEach((label) => console.log(`- ${label}`));
  }

  if (conflictLabels.length > 0) {
    console.log("Conflicts:");
    conflictLabels.forEach((label) => console.log(`- ${label}`));
  }

  if (dryRun) {
    console.log("Dry-run: no database changes applied.");
  }
}

main().catch((error: unknown) => {
  console.error("ESPN fixture mapping failed.");
  console.error(error);
  process.exitCode = 1;
});
