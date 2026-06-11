import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import {
  fetchWorldcup26GameByMongoId,
  fetchWorldcup26Games,
  mapWorldcup26GameToInternalScore,
  worldcup26TeamsMatch,
} from "../lib/scores/providers/worldcup26";
import type { LiveScoreFixture } from "../lib/scores/providers/types";

const ACTIVE_WINDOW_BEFORE_MINUTES = 240;
const ACTIVE_WINDOW_AFTER_MINUTES = 5;
const DEFAULT_POLL_INTERVAL_SECONDS = 60;

type WatchDatabase = {
  public: {
    Tables: {
      matches: {
        Row: MatchRow;
        Insert: never;
        Update: Partial<MatchUpdate>;
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
  score_provider: string | null;
  score_provider_fixture_id: string | null;
  status_short: string | null;
  status_long: string | null;
  elapsed: number | null;
  home_score_live: number | null;
  away_score_live: number | null;
  home_score: number | null;
  away_score: number | null;
  home_team: {
    name: string;
  } | null;
  away_team: {
    name: string;
  } | null;
};

type MatchUpdate = {
  score_provider: string | null;
  score_provider_fixture_id: string | null;
  status_short: string | null;
  status_long: string | null;
  elapsed: number | null;
  home_score_live: number | null;
  away_score_live: number | null;
  home_score: number | null;
  away_score: number | null;
  score_updated_at: string;
};

type WatchSupabaseClient = SupabaseClient<WatchDatabase>;

const FINAL_STATUSES = new Set(["FT", "AET", "PEN"]);

function loadEnvFile(path: string) {
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, "utf8");

  content.split(/\r?\n/).forEach((line) => {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmedLine.indexOf("=");

    if (separatorIndex === -1) {
      return;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    process.env[key] ??= value;
  });
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function optionalEnv(name: string) {
  return process.env[name]?.trim() || null;
}

function timestamp() {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

function log(message: string) {
  console.log(`[${timestamp()}] ${message}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createServiceClient(): WatchSupabaseClient {
  return createClient<WatchDatabase>(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

function pollIntervalMs() {
  const value = Number(optionalEnv("LOCAL_SCORE_POLL_INTERVAL_SECONDS"));

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_POLL_INTERVAL_SECONDS * 1000;
  }

  return value * 1000;
}

async function fetchActiveMatches(supabase: WatchSupabaseClient, now: Date) {
  const windowStart = new Date(
    now.getTime() - ACTIVE_WINDOW_BEFORE_MINUTES * 60 * 1000,
  );
  const windowEnd = new Date(
    now.getTime() + ACTIVE_WINDOW_AFTER_MINUTES * 60 * 1000,
  );

  const { data, error } = await supabase
    .from("matches")
    .select(
      `
      id,
      kickoff_at,
      score_provider,
      score_provider_fixture_id,
      status_short,
      status_long,
      elapsed,
      home_score_live,
      away_score_live,
      home_score,
      away_score,
      home_team:teams!matches_home_team_id_fkey(name),
      away_team:teams!matches_away_team_id_fkey(name)
    `,
    )
    .gte("kickoff_at", windowStart.toISOString())
    .lte("kickoff_at", windowEnd.toISOString())
    .order("kickoff_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as MatchRow[]).filter(
    (match) => !isFinalStatus(match.status_short),
  );
}

function isFinalStatus(statusShort: string | null | undefined) {
  return Boolean(statusShort && FINAL_STATUSES.has(statusShort));
}

function isCompleteScore(fixture: LiveScoreFixture) {
  return (
    typeof fixture.homeScore === "number" &&
    typeof fixture.awayScore === "number"
  );
}

function providerFixtureIdForMatch(match: MatchRow) {
  return match.score_provider === "worldcup26"
    ? match.score_provider_fixture_id
    : null;
}

function fixtureMatches(match: MatchRow, fixture: LiveScoreFixture) {
  return worldcup26TeamsMatch({
    localHomeName: match.home_team?.name,
    localAwayName: match.away_team?.name,
    providerHomeName: fixture.homeTeamName,
    providerAwayName: fixture.awayTeamName,
  });
}

async function fetchFixtureForMatch(
  match: MatchRow,
  fallbackFixtures: LiveScoreFixture[] | null,
) {
  const fixtureId = providerFixtureIdForMatch(match);

  if (fixtureId) {
    log(`Endpoint: /get/game/${fixtureId}`);
    const game = await fetchWorldcup26GameByMongoId(fixtureId);

    return mapWorldcup26GameToInternalScore(game, {
      homeTeamName: match.home_team?.name,
      awayTeamName: match.away_team?.name,
    });
  }

  return fallbackFixtures?.find((fixture) => fixtureMatches(match, fixture)) ?? null;
}

function localScoreLabel(match: MatchRow) {
  const homeScore =
    typeof match.home_score_live === "number"
      ? match.home_score_live
      : match.home_score;
  const awayScore =
    typeof match.away_score_live === "number"
      ? match.away_score_live
      : match.away_score;

  return `${homeScore ?? "null"} x ${awayScore ?? "null"}`;
}

function shouldSkipUpdate(match: MatchRow, fixture: LiveScoreFixture) {
  if (!isCompleteScore(fixture)) {
    return "Score invalido/null, nenhum update realizado";
  }

  if (fixture.statusShort === "NS") {
    return "Status notstarted, nenhum update realizado para evitar sobrescrever dado melhor";
  }

  if (isFinalStatus(match.status_short) && !isFinalStatus(fixture.statusShort)) {
    return `Banco ja esta ${match.status_short}; API retornou ${fixture.statusShort}`;
  }

  return null;
}

async function updateMatch(
  supabase: WatchSupabaseClient,
  match: MatchRow,
  fixture: LiveScoreFixture,
) {
  const now = new Date().toISOString();
  const isFinal = isFinalStatus(fixture.statusShort);
  const update: MatchUpdate = {
    score_provider: "worldcup26",
    score_provider_fixture_id: String(fixture.providerFixtureId),
    status_short: fixture.statusShort,
    status_long: fixture.statusLong,
    elapsed: fixture.elapsed,
    home_score_live: fixture.homeScore,
    away_score_live: fixture.awayScore,
    home_score: isFinal ? fixture.homeScore : match.home_score,
    away_score: isFinal ? fixture.awayScore : match.away_score,
    score_updated_at: now,
  };

  const { error } = await supabase
    .from("matches")
    .update(update)
    .eq("id", match.id);

  if (error) {
    throw error;
  }
}

async function runOnce(supabase: WatchSupabaseClient) {
  const activeMatches = await fetchActiveMatches(supabase, new Date());

  if (activeMatches.length === 0) {
    log("Nenhum jogo ativo agora");
    return;
  }

  activeMatches.forEach((match) => {
    log(
      `Jogo ativo encontrado: ${match.home_team?.name ?? "Casa"} x ${match.away_team?.name ?? "Fora"}`,
    );
  });

  log("Fonte: worldcup26");
  const needsFallbackMapping = activeMatches.some(
    (match) => !providerFixtureIdForMatch(match),
  );
  const fallbackFixtures = needsFallbackMapping
    ? (await fetchWorldcup26Games())
        .map((game) => mapWorldcup26GameToInternalScore(game))
        .filter((fixture): fixture is LiveScoreFixture => Boolean(fixture))
    : null;

  if (fallbackFixtures) {
    log(`Endpoint: /get/games`);
    log(`Jogos retornados: ${fallbackFixtures.length}`);
  }

  for (const match of activeMatches) {
    const fixture = await fetchFixtureForMatch(match, fallbackFixtures);

    if (!fixture) {
      log("Nenhum jogo correspondente encontrado na worldcup26");
      continue;
    }

    log(
      `Encontrado: ${fixture.homeTeamName} ${fixture.homeScore} x ${fixture.awayScore} ${fixture.awayTeamName} - ${fixture.statusLong}`,
    );

    const skipReason = shouldSkipUpdate(match, fixture);

    if (skipReason) {
      log(skipReason);
      continue;
    }

    if (
      match.home_score_live !== fixture.homeScore ||
      match.away_score_live !== fixture.awayScore
    ) {
      log(
        `Gol ou alteracao de placar detectada: ${match.home_team?.name ?? "Casa"} ${localScoreLabel(match)} ${match.away_team?.name ?? "Fora"} -> ${match.home_team?.name ?? "Casa"} ${fixture.homeScore} x ${fixture.awayScore} ${match.away_team?.name ?? "Fora"}`,
      );
    }

    try {
      await updateMatch(supabase, match, fixture);
      log("Supabase atualizado com sucesso");
    } catch (error) {
      const message = error instanceof Error ? error.message : "erro desconhecido";
      log(`Erro ao atualizar Supabase: ${message}`);
    }
  }
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const source = optionalEnv("LOCAL_SCORE_SOURCE") ?? "worldcup26";

  if (source !== "worldcup26") {
    log("LOCAL_SCORE_SOURCE diferente de worldcup26; usando somente worldcup26.");
  }

  const supabase = createServiceClient();
  const intervalMs = pollIntervalMs();
  const runOnceOnly = process.argv.includes("--once");

  log(
    `Watcher local iniciado. Intervalo: ${Math.round(intervalMs / 1000)}s. Ctrl+C para parar.`,
  );

  if (runOnceOnly) {
    await runOnce(supabase);
    return;
  }

  while (true) {
    await runOnce(supabase);
    log("Proxima verificacao...");
    await sleep(intervalMs);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "erro desconhecido";

  console.error(`[${timestamp()}] Watcher local falhou: ${message}`);
  process.exitCode = 1;
});
