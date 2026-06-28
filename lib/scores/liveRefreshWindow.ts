const DEFAULT_BEFORE_MINUTES = 5;
const DEFAULT_AFTER_MINUTES = 240;

export function isInLiveScoreRefreshWindow(
  startsAt: string | null | undefined,
  now: Date,
  beforeMinutes = DEFAULT_BEFORE_MINUTES,
  afterMinutes = DEFAULT_AFTER_MINUTES,
) {
  if (!startsAt) {
    return false;
  }

  const start = new Date(startsAt);
  const windowStart = new Date(start.getTime() - beforeMinutes * 60 * 1000);
  const windowEnd = new Date(start.getTime() + afterMinutes * 60 * 1000);

  return now >= windowStart && now <= windowEnd;
}
