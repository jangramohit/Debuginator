import { describe, expect, it } from "vitest";
import {
  detectSpike,
  hourOf,
  HOUR_MS,
  SPIKE_COOLDOWN_MS,
  staleHours,
  type HourlyCounts,
} from "../../src/alerts/spike.js";
import { renderAlertEmail, type AlertIssue } from "../../src/alerts/email.js";

const NOW = new Date("2026-11-25T10:30:00Z");
const H = hourOf(NOW);
const LONG_AGO = new Date(NOW.getTime() - 3 * 24 * HOUR_MS).toISOString();

/** `perHour` events in each of the 24 hours before NOW's, and `thisHour` in NOW's own. */
function history(perHour: number, thisHour = 0): HourlyCounts {
  const counts: HourlyCounts = { [String(H)]: thisHour };
  for (let i = 1; i <= 24; i++) counts[String(H - i)] = perHour;
  return counts;
}

const check = (over: Partial<Parameters<typeof detectSpike>[0]>) =>
  detectSpike({
    before: history(2),
    added: 0,
    now: NOW,
    trackedSince: LONG_AGO,
    lastSpikeAt: undefined,
    ...over,
  });

describe("detectSpike", () => {
  it("flags an hour far above the usual rate, with the numbers", () => {
    expect(check({ before: history(2, 15), added: 10 })).toEqual({
      hourCount: 25,
      usualPerHour: 2,
    });
  });

  it("needs at least 20 events, however quiet the error usually is", () => {
    expect(check({ before: history(0), added: 19 })).toBeUndefined();
    expect(check({ before: history(0), added: 20 })).toEqual({ hourCount: 20, usualPerHour: 0 });
  });

  it("needs at least 5 times the usual rate", () => {
    expect(check({ before: history(10), added: 49 })).toBeUndefined();
    expect(check({ before: history(10), added: 50 })).toBeDefined();
  });

  it("ignores hours outside the 24 before this one", () => {
    const before = { ...history(0), [String(H - 25)]: 1000, [String(H + 1)]: 1000 };
    expect(check({ before, added: 20 })).toEqual({ hourCount: 20, usualPerHour: 0 });
  });

  it("waits for a full day of counts", () => {
    const recent = new Date(NOW.getTime() - 23 * HOUR_MS).toISOString();
    expect(check({ added: 100, trackedSince: recent })).toBeUndefined();
    expect(check({ added: 100, trackedSince: undefined })).toBeUndefined();
  });

  it("flags an issue at most once per cooldown", () => {
    const justNow = new Date(NOW.getTime() - SPIKE_COOLDOWN_MS + 1000).toISOString();
    const before = new Date(NOW.getTime() - SPIKE_COOLDOWN_MS - 1000).toISOString();
    expect(check({ added: 100, lastSpikeAt: justNow })).toBeUndefined();
    expect(check({ added: 100, lastSpikeAt: before })).toBeDefined();
  });
});

describe("staleHours", () => {
  it("lists only the hours older than the baseline", () => {
    expect(staleHours({ [String(H - 25)]: 1, [String(H - 24)]: 1, [String(H)]: 1 }, NOW)).toEqual([
      String(H - 25),
    ]);
    expect(staleHours(undefined, NOW)).toEqual([]);
  });
});

describe("alert email with spikes", () => {
  const base: AlertIssue = {
    fingerprint: "fp1",
    title: { type: "HandledHttpError:POST:/create-credentials", message: "HTTP 500" },
    services: ["api"],
    environments: ["production"],
    count: 1500,
    firstSeen: "2026-11-13T05:00:00Z",
    stack: [],
  };

  it("names a single spike as one, with how far above usual it is", () => {
    const email = renderAlertEmail({
      orgName: "Leela",
      issues: [{ ...base, spike: { hourCount: 240, usualPerHour: 4.6 } }],
      more: 0,
      spikes: 1,
    });
    expect(email.subject).toBe(
      "Spike in api · production: HandledHttpError:POST:/create-credentials: HTTP 500",
    );
    expect(email.text).toContain("A known error is spiking in Leela.");
    expect(email.text).toContain("Spiking: 240 events this hour, usually about 5 an hour");
    expect(email.html).toContain("Spiking: 240 events this hour, usually about 5 an hour");
  });

  it("says when an error was quiet before", () => {
    const email = renderAlertEmail({
      orgName: "Leela",
      issues: [{ ...base, spike: { hourCount: 30, usualPerHour: 0 } }],
      more: 0,
    });
    expect(email.text).toContain("Spiking: 30 events this hour, none in the day before");
  });

  it("counts new errors and spikes apart when they share an email", () => {
    const email = renderAlertEmail({
      orgName: "Leela",
      issues: [
        { ...base, fingerprint: "fp-new" },
        { ...base, spike: { hourCount: 40, usualPerHour: 0.5 } },
      ],
      more: 0,
      spikes: 1,
    });
    expect(email.subject).toBe("1 new and 1 spiking error in api");
    expect(email.text).toContain("usually under 1 an hour");
  });

  it("a new-errors-only email reads as before", () => {
    const email = renderAlertEmail({
      orgName: "Leela",
      issues: [base, { ...base, fingerprint: "fp2" }],
      more: 0,
    });
    expect(email.subject).toBe("2 new errors in api");
    expect(email.text).not.toContain("Spiking");
  });
});
