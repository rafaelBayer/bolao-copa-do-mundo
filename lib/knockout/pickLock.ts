import type { KnockoutMatch } from "./types";

export function isKnockoutMatchPickLocked(
  match: Pick<KnockoutMatch, "startsAt">,
  now = new Date(),
) {
  if (!match.startsAt) {
    return false;
  }

  const startsAt = new Date(match.startsAt).getTime();

  if (!Number.isFinite(startsAt)) {
    return false;
  }

  return now.getTime() >= startsAt - 10 * 60 * 1000;
}
