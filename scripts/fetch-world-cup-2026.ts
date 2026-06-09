import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { openFootballToWorldCupSeedData } from "../lib/world-cup/openFootballAdapter";
import { validateWorldCupData } from "../lib/world-cup/validateWorldCupData";
import type { WorldCupSeedData } from "../types/worldCupData";

const OPENFOOTBALL_WORLD_CUP_2026_URL =
  process.env.OPENFOOTBALL_WORLD_CUP_2026_URL ??
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

const rawOutputPath = join("data", "raw", "openfootball-worldcup-2026.json");
const finalOutputPath = join("data", "world-cup-2026.ts");

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

function currentIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function resolveOpenFootballUrl() {
  const configuredUrl = process.env.OPENFOOTBALL_WORLD_CUP_2026_URL?.trim();

  return configuredUrl || OPENFOOTBALL_WORLD_CUP_2026_URL;
}

function ensureParentDirectory(path: string) {
  mkdirSync(dirname(path), { recursive: true });
}

function formatWorldCupData(data: WorldCupSeedData) {
  return `import type { WorldCupSeedData } from "@/types/worldCupData";

export const worldCup2026Data: WorldCupSeedData = ${JSON.stringify(
    data,
    null,
    2,
  )};
`;
}

function printErrors(title: string, errors: string[]) {
  console.error(title);
  errors.forEach((error) => {
    console.error(`- ${error}`);
  });
}

async function fetchOpenFootballJson(url: string) {
  let response: Response;

  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(
      `Failed to fetch OpenFootball JSON from ${url}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch OpenFootball JSON from ${url}: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const text = await response.text();

  try {
    return {
      rawText: text,
      rawData: JSON.parse(text) as unknown,
    };
  } catch (error) {
    throw new Error(
      `OpenFootball response from ${url} is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const url = resolveOpenFootballUrl();

  console.log("Fetching OpenFootball World Cup 2026 JSON...");
  console.log(`URL: ${url}`);

  const { rawText, rawData } = await fetchOpenFootballJson(url);

  ensureParentDirectory(rawOutputPath);
  writeFileSync(rawOutputPath, rawText, "utf8");
  console.log(`Saved raw OpenFootball JSON to ${rawOutputPath}.`);

  let worldCupData: WorldCupSeedData;

  try {
    worldCupData = openFootballToWorldCupSeedData({
      rawData,
      updatedAt: currentIsoDate(),
    });
  } catch (error) {
    console.error("Failed to normalize OpenFootball JSON.");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  console.log("Validating normalized data...");
  const validation = validateWorldCupData(worldCupData);

  if (!validation.valid) {
    printErrors("OpenFootball World Cup 2026 data is invalid.", validation.errors);
    process.exit(1);
  }

  writeFileSync(finalOutputPath, formatWorldCupData(worldCupData), "utf8");
  console.log(`Wrote ${finalOutputPath}.`);
  console.log("OpenFootball World Cup 2026 data is valid.");
  console.log(`Groups: ${validation.summary.groups}`);
  console.log(`Teams: ${validation.summary.teams}`);
  console.log(`Group matches: ${validation.summary.matches}`);
}

main().catch((error: unknown) => {
  console.error("World Cup fetch failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
