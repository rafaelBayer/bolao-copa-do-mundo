import { existsSync, readFileSync } from "node:fs";

export type SupabaseTarget = "default" | "legacy" | "public";

export type ScriptSupabaseConfig = {
  target: SupabaseTarget;
  url: string;
  anonKey: string | null;
  serviceRoleKey: string;
};

type ResolvedSupabaseEnv = {
  target: SupabaseTarget;
  url: string | undefined;
  anonKey: string | undefined;
  serviceRoleKey: string | undefined;
};

export function loadScriptEnvFile(path: string) {
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

export function loadScriptEnvFiles() {
  loadScriptEnvFile(".env.local");
  loadScriptEnvFile(".env");
}

function optionalEnv(name: string) {
  return process.env[name]?.trim() || undefined;
}

function resolveTarget(): SupabaseTarget {
  const target = optionalEnv("SUPABASE_TARGET")?.toLowerCase();

  if (!target) {
    return "default";
  }

  if (target === "legacy" || target === "public") {
    return target;
  }

  throw new Error(
    `Invalid SUPABASE_TARGET "${target}". Use "legacy", "public" or leave it empty.`,
  );
}

export function resolveSupabaseEnv(): ResolvedSupabaseEnv {
  const target = resolveTarget();

  if (target === "legacy") {
    return {
      target,
      url: optionalEnv("LEGACY_SUPABASE_URL"),
      anonKey: optionalEnv("LEGACY_SUPABASE_ANON_KEY"),
      serviceRoleKey: optionalEnv("LEGACY_SUPABASE_SERVICE_ROLE_KEY"),
    };
  }

  if (target === "public") {
    return {
      target,
      url: optionalEnv("PUBLIC_SUPABASE_URL"),
      anonKey: optionalEnv("PUBLIC_SUPABASE_ANON_KEY"),
      serviceRoleKey: optionalEnv("PUBLIC_SUPABASE_SERVICE_ROLE_KEY"),
    };
  }

  return {
    target: "default",
    url: optionalEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey:
      optionalEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
      optionalEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    serviceRoleKey: optionalEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function getScriptSupabaseConfig(): ScriptSupabaseConfig {
  const config = resolveSupabaseEnv();

  if (!config.url) {
    throw new Error(`Supabase URL is not configured for target: ${config.target}`);
  }

  if (!config.serviceRoleKey) {
    throw new Error(
      `Supabase service role key is not configured for target: ${config.target}`,
    );
  }

  return {
    target: config.target,
    url: config.url,
    anonKey: config.anonKey ?? null,
    serviceRoleKey: config.serviceRoleKey,
  };
}

export function isDryRunEnabled() {
  return (
    process.env.DRY_RUN?.trim().toLowerCase() === "true" ||
    process.argv.includes("--dry-run")
  );
}

export function supabaseProjectRef(url: string) {
  try {
    const hostname = new URL(url).hostname;
    const [projectRef] = hostname.split(".");

    return projectRef || hostname;
  } catch {
    return "unknown";
  }
}

export function logScriptSupabaseTarget(
  title: string,
  config: ScriptSupabaseConfig,
  dryRun?: boolean,
) {
  console.log(title);
  console.log(`Supabase target: ${config.target}`);
  console.log(`Supabase project: ${supabaseProjectRef(config.url)}`);

  if (typeof dryRun === "boolean") {
    console.log(`Dry run: ${dryRun ? "true" : "false"}`);
  }
}
