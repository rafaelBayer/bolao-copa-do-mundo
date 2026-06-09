import { worldCup2026Data } from "../data/world-cup-2026";
import { validateWorldCupData } from "../lib/world-cup/validateWorldCupData";

const result = validateWorldCupData(worldCup2026Data);

if (result.valid) {
  console.log("World Cup 2026 data is valid.");
  console.log(`Groups: ${result.summary.groups}`);
  console.log(`Teams: ${result.summary.teams}`);
  console.log(`Group matches: ${result.summary.matches}`);
} else {
  console.error("World Cup 2026 data is invalid.");
  console.error(`Groups: ${result.summary.groups}`);
  console.error(`Teams: ${result.summary.teams}`);
  console.error(`Group matches: ${result.summary.matches}`);
  console.error("");
  console.error("Errors:");
  result.errors.forEach((error) => {
    console.error(`- ${error}`);
  });
  process.exit(1);
}
