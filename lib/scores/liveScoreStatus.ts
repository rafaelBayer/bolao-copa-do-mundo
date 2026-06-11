export const FINAL_MATCH_STATUSES = new Set(["FT", "AET", "PEN"]);
export const LIVE_MATCH_STATUSES = new Set(["1H", "2H", "LIVE", "ET", "BT", "P"]);

export function isFinalMatchStatus(statusShort: string | null | undefined) {
  return Boolean(statusShort && FINAL_MATCH_STATUSES.has(statusShort));
}

export function isHalftimeStatus(statusShort: string | null | undefined) {
  return statusShort === "HT";
}

export function isLiveMatchStatus(statusShort: string | null | undefined) {
  return Boolean(statusShort && LIVE_MATCH_STATUSES.has(statusShort));
}
