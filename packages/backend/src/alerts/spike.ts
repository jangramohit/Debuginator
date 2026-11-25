/**
 * Spike alerts: an error BugBuster already knows about suddenly happening far more often than it
 * usually does (or coming back after being quiet). New-issue alerts never cover this, because the
 * issue is not new; a broken endpoint that has failed a few times a day for a week and then fails
 * hundreds of times in an hour would otherwise never send an email.
 *
 * Ingest keeps each issue's event counts per clock hour (`IssueDocument.hourly`). As a fold lands,
 * its hour's count is compared with the issue's usual rate, the average per hour over the 24 hours
 * before it. Pure functions here; the storage side is in db/collections/issues.ts.
 */

export const HOUR_MS = 60 * 60 * 1000;
/** Hours the usual rate is averaged over; also how long counts must have been kept first. */
export const SPIKE_BASELINE_HOURS = 24;
/** Fewest events in one hour that can be a spike, however quiet the error usually is. */
export const SPIKE_MIN_EVENTS = 20;
/** How many times its usual hourly rate an error must reach in one hour to be a spike. */
export const SPIKE_FACTOR = 5;
/** After a spike is flagged, the same issue is not flagged again for this long. */
export const SPIKE_COOLDOWN_MS = 6 * HOUR_MS;

/** The clock hour a time falls in, as a whole number of hours since the epoch. */
export function hourOf(at: Date): number {
  return Math.floor(at.getTime() / HOUR_MS);
}

/** Hourly counts, keyed by `hourOf`. Stored as strings by MongoDB, so keys are strings here. */
export type HourlyCounts = Record<string, number>;

export interface SpikeFacts {
  /** Events in the current clock hour, including the fold just applied. */
  hourCount: number;
  /** The usual rate: average events per hour over the SPIKE_BASELINE_HOURS before this one. */
  usualPerHour: number;
}

/**
 * Whether this hour's count makes a spike. `before` is the issue's hourly counts as they were
 * before the fold, `added` the fold's count; `trackedSince` is when counting began for the issue
 * (a spike needs a full baseline behind it, or every error would look like one right after the
 * backend started counting); `lastSpikeAt` is when it last spiked, for the cooldown.
 */
export function detectSpike(input: {
  before: HourlyCounts | undefined;
  added: number;
  now: Date;
  trackedSince: string | undefined;
  lastSpikeAt: string | undefined;
}): SpikeFacts | undefined {
  const { before, added, now } = input;
  const nowMs = now.getTime();
  if (!input.trackedSince) return undefined;
  if (nowMs - new Date(input.trackedSince).getTime() < SPIKE_BASELINE_HOURS * HOUR_MS) {
    return undefined;
  }
  if (input.lastSpikeAt && nowMs - new Date(input.lastSpikeAt).getTime() < SPIKE_COOLDOWN_MS) {
    return undefined;
  }
  const hour = hourOf(now);
  const hourCount = (before?.[String(hour)] ?? 0) + added;
  if (hourCount < SPIKE_MIN_EVENTS) return undefined;
  let total = 0;
  for (let h = hour - SPIKE_BASELINE_HOURS; h < hour; h++) total += before?.[String(h)] ?? 0;
  const usualPerHour = total / SPIKE_BASELINE_HOURS;
  if (hourCount < SPIKE_FACTOR * usualPerHour) return undefined;
  return { hourCount, usualPerHour };
}

/** Hour keys too old to matter to any spike check, to remove from the issue. */
export function staleHours(counts: HourlyCounts | undefined, now: Date): string[] {
  if (!counts) return [];
  const oldest = hourOf(now) - SPIKE_BASELINE_HOURS;
  return Object.keys(counts).filter((k) => Number(k) < oldest);
}
