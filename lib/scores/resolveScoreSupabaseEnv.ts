import { loadScriptEnvFile, supabaseProjectRef } from "@/lib/supabase/scriptEnv";

export type ScoreSupabaseTarget =
  | "production"
  | "staging"
  | "legacy"
  | "local";

export type ScoreSupabaseConfig = {
  target: ScoreSupabaseTarget;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
};

const VALID_TARGETS: ScoreSupabaseTarget[] = [
  "production",
  "staging",
  "legacy",
  "local",
];

function optionalEnv(name: string) {
  return process.env[name]?.trim() || undefined;
}

function targetEnvPrefix(target: ScoreSupabaseTarget) {
  return `SCORE_SUPABASE_${target.toUpperCase()}`;
}

function resolveTarget(): ScoreSupabaseTarget {
  const target = (optionalEnv("SCORE_SUPABASE_TARGET") ?? "production")
    .toLowerCase();

  if (VALID_TARGETS.includes(target as ScoreSupabaseTarget)) {
    return target as ScoreSupabaseTarget;
  }

  throw new Error(
    `Invalid SCORE_SUPABASE_TARGET "${target}". Use production, staging, legacy or local.`,
  );
}

function resolveTargets(): ScoreSupabaseTarget[] {
  const rawTarget = optionalEnv("SCORE_SUPABASE_TARGET") ?? "production";
  const targets =
    rawTarget.trim().toLowerCase() === "all"
      ? VALID_TARGETS
      : rawTarget
          .split(",")
          .map((target) => target.trim().toLowerCase())
          .filter(Boolean);

  if (targets.length === 0) {
    return ["production"];
  }

  const uniqueTargets = Array.from(new Set(targets));
  const invalidTarget = uniqueTargets.find(
    (target) => !VALID_TARGETS.includes(target as ScoreSupabaseTarget),
  );

  if (invalidTarget) {
    throw new Error(
      `Invalid SCORE_SUPABASE_TARGET "${invalidTarget}". Use production, staging, legacy, local, all, or a comma-separated list.`,
    );
  }

  return uniqueTargets as ScoreSupabaseTarget[];
}

export function loadScoreScriptEnvFiles() {
  loadScriptEnvFile(".env.local");
  loadScriptEnvFile(".env");
  loadScriptEnvFile(".env.scores.local");
}

export function resolveScoreSupabaseEnv(): ScoreSupabaseConfig {
  loadScoreScriptEnvFiles();

  const target = resolveTarget();
  return resolveScoreSupabaseConfig(target);
}

function resolveScoreSupabaseConfig(
  target: ScoreSupabaseTarget,
): ScoreSupabaseConfig {
  const prefix = targetEnvPrefix(target);
  const supabaseUrl = optionalEnv(`${prefix}_URL`);
  const supabaseServiceRoleKey = optionalEnv(`${prefix}_SERVICE_ROLE_KEY`);

  if (!supabaseUrl) {
    throw new Error(`Missing ${prefix}_URL`);
  }

  if (!supabaseServiceRoleKey) {
    throw new Error(`Missing ${prefix}_SERVICE_ROLE_KEY`);
  }

  return {
    target,
    supabaseUrl,
    supabaseServiceRoleKey,
  };
}

export function resolveScoreSupabaseEnvs(): ScoreSupabaseConfig[] {
  loadScoreScriptEnvFiles();

  return resolveTargets().map(resolveScoreSupabaseConfig);
}

export function isScoreDryRunEnabled() {
  return (
    process.env.DRY_RUN?.trim().toLowerCase() === "true" ||
    process.argv.includes("--dry-run")
  );
}

export function logScoreSupabaseTarget(
  title: string,
  config: ScoreSupabaseConfig,
  dryRun?: boolean,
) {
  console.log(`\n=== ${title} ===`);
  console.log(`Using score Supabase target: ${config.target}`);
  console.log(`Supabase project: ${supabaseProjectRef(config.supabaseUrl)}`);

  if (typeof dryRun === "boolean") {
    console.log(`Dry run: ${dryRun ? "true" : "false"}`);
  }
}

export function logScoreSupabaseTargets(
  title: string,
  configs: ScoreSupabaseConfig[],
  dryRun?: boolean,
) {
  console.log(`\n=== ${title} ===`);
  console.log(`Targets: ${configs.map((config) => config.target).join(", ")}`);
  console.log(`Target count: ${configs.length}`);

  if (typeof dryRun === "boolean") {
    console.log(`Dry run: ${dryRun ? "true" : "false"}`);
  }

  configs.forEach((config) => {
    console.log(
      `- ${config.target}: project ${supabaseProjectRef(config.supabaseUrl)}`,
    );
  });
}
