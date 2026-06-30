import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  fetchEspnSummaryByEventId,
  getEspnWinner,
} from "../lib/scores/providers/espn";
import {
  isScoreDryRunEnabled,
  logScoreSupabaseTarget,
  logScoreSupabaseTargets,
  resolveScoreSupabaseEnvs,
} from "../lib/scores/resolveScoreSupabaseEnv";

type Database = {
  public: {
    Tables: {
      knockout_matches: {
        Row: KnockoutMatchRow;
        Insert: never;
        Update: KnockoutMatchUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type KnockoutMatchRow = {
  id: string;
  tournament_key: string;
  round: string;
  position: number;
  starts_at: string | null;
  team_a: string | null;
  team_a_code: string | null;
  team_b: string | null;
  team_b_code: string | null;
  home_score: number | null;
  away_score: number | null;
  status_short: string | null;
  score_provider: string | null;
  score_provider_fixture_id: string | null;
  external_match_id: string | null;
  winner_team: string | null;
  winner_team_code: string | null;
};

type KnockoutMatchUpdate = {
  winner_team: string;
  winner_team_code: string | null;
};

type DbClient = SupabaseClient<Database>;

function matchLabel(match: KnockoutMatchRow) {
  return `${match.round} ${match.position}: ${match.team_a ?? "Time A"} x ${
    match.team_b ?? "Time B"
  }`;
}

function fixtureIdForMatch(match: KnockoutMatchRow) {
  return match.score_provider === "espn"
    ? match.score_provider_fixture_id ?? match.external_match_id
    : null;
}

function localWinnerFromSide(
  match: KnockoutMatchRow,
  side: "home" | "away" | null,
) {
  if (side === "home" && match.team_a) {
    return {
      name: match.team_a,
      code: match.team_a_code,
    };
  }

  if (side === "away" && match.team_b) {
    return {
      name: match.team_b,
      code: match.team_b_code,
    };
  }

  return null;
}

function normalizedSide(value: string | null | undefined) {
  return value === "home" || value === "away" ? value : null;
}

async function fetchPendingMatches(supabase: DbClient) {
  const { data, error } = await supabase
    .from("knockout_matches")
    .select(
      [
        "id",
        "tournament_key",
        "round",
        "position",
        "starts_at",
        "team_a",
        "team_a_code",
        "team_b",
        "team_b_code",
        "home_score",
        "away_score",
        "status_short",
        "score_provider",
        "score_provider_fixture_id",
        "external_match_id",
        "winner_team",
        "winner_team_code",
      ].join(", "),
    )
    .eq("score_provider", "espn")
    .not("home_score", "is", null)
    .not("away_score", "is", null)
    .is("winner_team", null)
    .order("starts_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as KnockoutMatchRow[];
}

async function repairTarget(input: {
  supabase: DbClient;
  dryRun: boolean;
}) {
  const pendingMatches = await fetchPendingMatches(input.supabase);
  let repaired = 0;
  let skipped = 0;

  console.log(`Pending knockout winners: ${pendingMatches.length}`);

  for (const match of pendingMatches) {
    const fixtureId = fixtureIdForMatch(match);

    if (!fixtureId) {
      skipped += 1;
      console.log(`Skipped without ESPN fixture id: ${matchLabel(match)}`);
      continue;
    }

    const event = await fetchEspnSummaryByEventId(fixtureId);
    const espnWinner = getEspnWinner(event);
    const localWinner = localWinnerFromSide(
      match,
      normalizedSide(espnWinner?.side),
    );

    if (!localWinner) {
      skipped += 1;
      console.log(
        `Skipped without ESPN winner side: ${matchLabel(match)} (${fixtureId})`,
      );
      continue;
    }

    const update = {
      winner_team: localWinner.name,
      winner_team_code: localWinner.code ?? espnWinner?.code ?? null,
    };

    console.log(
      `${input.dryRun ? "Would repair" : "Repairing"} ${matchLabel(
        match,
      )} (${match.home_score} x ${match.away_score}) -> ${update.winner_team}`,
    );

    if (!input.dryRun) {
      const { error } = await input.supabase
        .from("knockout_matches")
        .update(update)
        .eq("id", match.id);

      if (error) {
        throw error;
      }
    }

    repaired += 1;
  }

  console.log(`Repaired: ${repaired}`);
  console.log(`Skipped: ${skipped}`);
}

async function main() {
  const dryRun = isScoreDryRunEnabled();
  const supabaseConfigs = resolveScoreSupabaseEnvs();

  logScoreSupabaseTargets(
    "ESPN knockout winner repair multi-target run",
    supabaseConfigs,
    dryRun,
  );

  for (const supabaseConfig of supabaseConfigs) {
    logScoreSupabaseTarget("ESPN knockout winner repair", supabaseConfig, dryRun);

    const supabase = createClient<Database>(
      supabaseConfig.supabaseUrl,
      supabaseConfig.supabaseServiceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    await repairTarget({ supabase, dryRun });
  }
}

main().catch((error: unknown) => {
  console.error("ESPN knockout winner repair failed.");
  console.error(error);
  process.exitCode = 1;
});
