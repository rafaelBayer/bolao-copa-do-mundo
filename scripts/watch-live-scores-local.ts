import { appendFileSync, mkdirSync } from "node:fs";
import { runLiveScoreSync } from "../lib/scores/runLiveScoreSync";
import { loadScriptEnvFiles } from "../lib/supabase/scriptEnv";

const DEFAULT_POLL_INTERVAL_SECONDS = 30;
const LOG_FILE_PATH = "logs/scores-watch-local-current.log";

function formatConsoleArg(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Error) {
    return value.stack ?? value.message;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function appendLocalLogLine(args: unknown[]) {
  mkdirSync("logs", { recursive: true });
  appendFileSync(
    LOG_FILE_PATH,
    `${args.map(formatConsoleArg).join(" ")}\n`,
    "utf8",
  );
}

const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

console.log = (...args: unknown[]) => {
  appendLocalLogLine(args);
  originalConsole.log(...args);
};

console.warn = (...args: unknown[]) => {
  appendLocalLogLine(args);
  originalConsole.warn(...args);
};

console.error = (...args: unknown[]) => {
  appendLocalLogLine(args);
  originalConsole.error(...args);
};

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

function pollIntervalMs() {
  const value = Number(optionalEnv("LOCAL_SCORE_POLL_INTERVAL_SECONDS"));

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_POLL_INTERVAL_SECONDS * 1000;
  }

  return value * 1000;
}

async function runOnce() {
  const result = await runLiveScoreSync();

  log(`Provider: ${result.provider}`);
  log(`Status: ${result.status} (${result.reason})`);
  log(`Jogos ativos: ${result.activeMatches ?? 0}`);
  log(`Updated matches: ${result.updatedMatches}`);
  log(`External requests: ${result.externalRequests}`);

  if (result.liveFixtures !== undefined) {
    log(`Live fixtures: ${result.liveFixtures}`);
  }

  if (result.nextRecommendedSyncInSeconds) {
    log(`Proximo sync recomendado: ${result.nextRecommendedSyncInSeconds}s`);
  } else if (result.nextRecommendedSyncInMinutes) {
    log(`Proximo sync recomendado: ${result.nextRecommendedSyncInMinutes}min`);
  }

  if (result.message) {
    log(`Mensagem: ${result.message}`);
  }
}

async function main() {
  loadScriptEnvFiles();

  const localSource = optionalEnv("LOCAL_SCORE_SOURCE");

  if (localSource) {
    process.env.LIVE_SCORE_PROVIDER = localSource;
  }

  const intervalMs = pollIntervalMs();
  const runOnceOnly = process.argv.includes("--once");

  log(
    `Watcher local iniciado. Fonte: ${process.env.LIVE_SCORE_PROVIDER ?? "manual"}. Intervalo: ${Math.round(intervalMs / 1000)}s.`,
  );

  if (runOnceOnly) {
    await runOnce();
    return;
  }

  while (true) {
    await runOnce();
    log("Proxima verificacao...");
    await sleep(intervalMs);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "erro desconhecido";

  console.error(`[${timestamp()}] Watcher local falhou: ${message}`);
  process.exitCode = 1;
});
