import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

type TeamRow = {
  id: string;
  name: string;
  code: string | null;
};

type PoolRow = {
  id: string;
  name: string | null;
};

const FIRST_ROUND_MATCH_IDS = Array.from({ length: 16 }, (_, index) => {
  const position = String(index + 1).padStart(3, "0");

  return `10000000-0000-0000-0000-000000000${position}`;
});

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
    throw new Error(`Env obrigatoria ausente: ${name}`);
  }

  return value;
}

function nextMonthLockAt() {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCHours(23, 59, 0, 0);

  return date.toISOString();
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const targetPoolId = process.env.PLAYOFF_MOCK_POOL_ID?.trim() || null;
  const resetPicks = process.argv.includes("--reset-picks");

  const { data: pools, error: poolsError } = await supabase
    .from("pools")
    .select("id, name")
    .order("created_at", { ascending: true })
    .limit(targetPoolId ? 1000 : 1);

  if (poolsError) {
    throw poolsError;
  }

  const pool = ((pools ?? []) as PoolRow[]).find((item) =>
    targetPoolId ? item.id === targetPoolId : true,
  );

  if (!pool) {
    throw new Error(
      targetPoolId
        ? "Pool informado em PLAYOFF_MOCK_POOL_ID nao foi encontrado."
        : "Nenhum pool encontrado para popular o mock.",
    );
  }

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, code")
    .order("name", { ascending: true })
    .limit(32);

  if (teamsError) {
    throw teamsError;
  }

  const selectedTeams = (teams ?? []) as TeamRow[];

  if (selectedTeams.length < 32) {
    throw new Error(
      `Mock precisa de 32 selecoes, mas encontrou ${selectedTeams.length}.`,
    );
  }

  const lockAt = nextMonthLockAt();

  for (let index = 0; index < FIRST_ROUND_MATCH_IDS.length; index += 1) {
    const home = selectedTeams[index * 2];
    const away = selectedTeams[index * 2 + 1];

    const { error } = await supabase
      .from("playoff_matches")
      .update({
        home_team_id: home.id,
        away_team_id: away.id,
        source_home: `Mock ${home.name}`,
        source_away: `Mock ${away.name}`,
        kickoff_at: index === 0 ? lockAt : null,
      })
      .eq("id", FIRST_ROUND_MATCH_IDS[index]);

    if (error) {
      throw error;
    }
  }

  const { error: settingsError } = await supabase
    .from("playoff_settings")
    .upsert(
      {
        pool_id: pool.id,
        is_enabled: true,
        first_match_kickoff_at: lockAt,
      },
      { onConflict: "pool_id" },
    );

  if (settingsError) {
    throw settingsError;
  }

  if (resetPicks) {
    const { error } = await supabase
      .from("playoff_picks")
      .delete()
      .eq("pool_id", pool.id);

    if (error) {
      throw error;
    }
  }

  console.log("Mock dos playoffs aplicado com sucesso.");
  console.log(`Pool: ${pool.name ?? pool.id}`);
  console.log(`Confrontos iniciais preenchidos: ${FIRST_ROUND_MATCH_IDS.length}`);
  console.log(`Playoffs liberados: sim`);
  console.log(`Prazo mock: ${lockAt}`);
  console.log(
    resetPicks
      ? "Palpites anteriores removidos para este pool."
      : "Palpites anteriores preservados. Use -- --reset-picks para limpar.",
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "erro desconhecido";

  console.error(`Falha ao aplicar mock dos playoffs: ${message}`);
  process.exitCode = 1;
});
