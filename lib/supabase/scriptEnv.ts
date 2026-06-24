import { existsSync, readFileSync } from "node:fs";

export type ScriptSupabaseConfig = {
  target: "app";
  url: string;
  anonKey: string | null;
  serviceRoleKey: string;
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

export function getScriptSupabaseConfig(): ScriptSupabaseConfig {
  return {
    target: "app",
    url: requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey:
      optionalEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
      optionalEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    serviceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
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
