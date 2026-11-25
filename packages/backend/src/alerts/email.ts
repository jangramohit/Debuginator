import type { AlertEmail } from "./brevo.js";

/**
 * The alert email: plain, readable in any mail client (tables and inline styles only), with a
 * text version alongside. Everything that came from an application (error messages, service
 * names, stack traces) is escaped: it is untrusted input, exactly as in the dashboard.
 */

export interface AlertIssue {
  fingerprint: string;
  title?: { type: string; message: string };
  services: string[];
  environments: string[];
  count: number;
  firstSeen: string;
  topEndpoint?: string;
  /** The first lines of the first example's stack trace; empty when stacks are left out. */
  stack: string[];
  /** Set when the alert is a known error spiking, not a new one (alerts/spike.ts). */
  spike?: { hourCount: number; usualPerHour: number };
}

export interface AlertEmailInput {
  orgName: string;
  issues: AlertIssue[];
  /** Issues not listed in this email (it lists at most a handful). */
  more: number;
  /** How many of all the issues (listed or not) are spikes rather than new errors. */
  spikes?: number;
  dashboardUrl?: string;
}

const MAX_SUBJECT_CHARS = 140;
const istFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : istFormat.format(d) + " IST";
}

function headline(i: AlertIssue): string {
  if (!i.title) return i.fingerprint;
  return i.title.message ? `${i.title.type}: ${i.title.message}` : i.title.type;
}

function where(i: AlertIssue): string {
  return [i.services.join(", "), i.environments.join(", ")].filter(Boolean).join(" · ");
}

function facts(i: AlertIssue): string {
  const count = `${i.count} ${i.count === 1 ? "event" : "events"} so far`;
  return [where(i), count, `first seen ${when(i.firstSeen)}`].filter(Boolean).join(" · ");
}

/** "240 events this hour, usually about 5 an hour": what makes a spike a spike. */
function spikeLine(spike: NonNullable<AlertIssue["spike"]>): string {
  const now = `${spike.hourCount} ${spike.hourCount === 1 ? "event" : "events"} this hour`;
  const usual =
    spike.usualPerHour === 0
      ? "none in the day before"
      : spike.usualPerHour < 1
        ? "usually under 1 an hour"
        : `usually about ${Math.round(spike.usualPerHour)} an hour`;
  return `Spiking: ${now}, ${usual}`;
}

/** How many of the email's issues are new errors and how many are spikes. */
function kinds(input: AlertEmailInput): { total: number; spikes: number; fresh: number } {
  const total = input.issues.length + input.more;
  const spikes = input.spikes ?? input.issues.filter((i) => i.spike).length;
  return { total, spikes, fresh: total - spikes };
}

function issueLink(dashboardUrl: string | undefined, fingerprint: string): string | undefined {
  if (!dashboardUrl) return undefined;
  return `${dashboardUrl.replace(/\/+$/, "")}/#issues/${encodeURIComponent(fingerprint)}`;
}

function subjectFor(input: AlertEmailInput): string {
  const { total, spikes, fresh } = kinds(input);
  if (total === 1 && input.issues[0]) {
    const i = input.issues[0];
    const place = where(i);
    const what = i.spike ? "Spike" : "New error";
    return clip(`${what}${place ? ` in ${place}` : ""}: ${headline(i)}`, MAX_SUBJECT_CHARS);
  }
  const services = [...new Set(input.issues.flatMap((i) => i.services))];
  const inWhat =
    services.length === 0
      ? input.orgName
      : services.length <= 3
        ? services.join(", ")
        : `${services.slice(0, 3).join(", ")} and ${services.length - 3} more`;
  const what =
    spikes === 0
      ? `${total} new errors`
      : fresh === 0
        ? `${total} errors spiking`
        : `${fresh} new and ${spikes} spiking ${spikes === 1 ? "error" : "errors"}`;
  return clip(`${what} in ${inWhat}`, MAX_SUBJECT_CHARS);
}

function headingFor(input: AlertEmailInput): string {
  const { total, spikes, fresh } = kinds(input);
  if (spikes === 0) return total === 1 ? "A new error appeared" : `${total} new errors appeared`;
  if (fresh === 0)
    return total === 1 ? "A known error is spiking" : `${total} known errors are spiking`;
  return `${fresh} new and ${spikes} spiking ${spikes === 1 ? "error" : "errors"}`;
}

function introFor(input: AlertEmailInput): string {
  const { spikes, fresh } = kinds(input);
  if (spikes === 0) return `Errors BugBuster has not seen before in ${input.orgName}.`;
  if (fresh === 0) {
    return `Errors BugBuster already knew about in ${input.orgName}, now happening far more often than usual.`;
  }
  return `Errors BugBuster has not seen before in ${input.orgName}, and known ones now happening far more often than usual.`;
}

const INK = "#14181b";
const MUTED = "#5b6670";
const RULE = "#dde3e7";
const LINK = "#1a5fb4";
const SPIKE = "#a4420a";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

function issueHtml(i: AlertIssue, dashboardUrl: string | undefined): string {
  const link = issueLink(dashboardUrl, i.fingerprint);
  const title = i.title
    ? `<strong>${escapeHtml(i.title.type)}</strong>${i.title.message ? `: ${escapeHtml(i.title.message)}` : ""}`
    : `<code style="font-family:${MONO}">${escapeHtml(i.fingerprint)}</code>`;
  const parts = [
    `<p style="margin:0 0 6px;font-size:15px;line-height:22px;color:${INK};word-break:break-word">${title}</p>`,
    ...(i.spike
      ? [
          `<p style="margin:0 0 4px;font-size:13px;line-height:20px;color:${SPIKE};font-weight:600">${escapeHtml(spikeLine(i.spike))}</p>`,
        ]
      : []),
    `<p style="margin:0;font-size:13px;line-height:20px;color:${MUTED}">${escapeHtml(facts(i))}</p>`,
  ];
  if (i.topEndpoint) {
    parts.push(
      `<p style="margin:4px 0 0;font-size:13px;line-height:20px;color:${MUTED}">Most often on <span style="font-family:${MONO};color:${INK}">${escapeHtml(i.topEndpoint)}</span></p>`,
    );
  }
  if (i.stack.length > 0) {
    parts.push(
      `<pre style="margin:10px 0 0;padding:10px 12px;background:#f4f6f8;border:1px solid ${RULE};border-radius:6px;font-family:${MONO};font-size:12px;line-height:18px;color:${INK};white-space:pre-wrap;word-break:break-all">${escapeHtml(i.stack.join("\n"))}</pre>`,
    );
  }
  if (link) {
    parts.push(
      `<p style="margin:10px 0 0;font-size:14px"><a href="${escapeHtml(link)}" style="color:${LINK};text-decoration:none;font-weight:600">Open in BugBuster →</a></p>`,
    );
  }
  return `<tr><td style="padding:16px 0;border-top:1px solid ${RULE}">${parts.join("")}</td></tr>`;
}

function page(orgName: string, heading: string, body: string, footer: string): string {
  return (
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>` +
    `<body style="margin:0;padding:0;background:#ffffff;font-family:${FONT};color:${INK}">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td align="center" style="padding:24px 16px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">` +
    `<tr><td style="padding:0 0 4px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${MUTED}">BugBuster · ${escapeHtml(orgName)}</td></tr>` +
    `<tr><td style="padding:0 0 8px;font-size:20px;line-height:28px;font-weight:600;color:${INK}">${escapeHtml(heading)}</td></tr>` +
    body +
    `<tr><td style="padding:20px 0 0;border-top:1px solid ${RULE};font-size:12px;line-height:18px;color:${MUTED}">${footer}</td></tr>` +
    `</table></td></tr></table></body></html>`
  );
}

function footerText(orgName: string): string {
  return (
    `You get this because you are on ${orgName}'s alert list in BugBuster. ` +
    `To change who gets these, ask whoever runs your BugBuster backend.`
  );
}

export function renderAlertEmail(input: AlertEmailInput): AlertEmail {
  const heading = headingFor(input);
  const rows = input.issues.map((i) => issueHtml(i, input.dashboardUrl)).join("");
  const moreRow =
    input.more > 0
      ? `<tr><td style="padding:12px 0;border-top:1px solid ${RULE};font-size:14px;color:${MUTED}">…and ${input.more} more. ${
          input.dashboardUrl
            ? `<a href="${escapeHtml(input.dashboardUrl)}" style="color:${LINK};text-decoration:none">See them all in BugBuster</a>.`
            : "See them all in the dashboard."
        }</td></tr>`
      : "";
  const html = page(
    input.orgName,
    heading,
    `<tr><td style="padding:0 0 12px;font-size:14px;line-height:21px;color:${MUTED}">${escapeHtml(introFor(input))}</td></tr>` +
      rows +
      moreRow,
    escapeHtml(footerText(input.orgName)),
  );

  const text = [
    `${heading} in ${input.orgName}.`,
    "",
    ...input.issues.flatMap((i) => {
      const link = issueLink(input.dashboardUrl, i.fingerprint);
      return [
        headline(i),
        ...(i.spike ? [spikeLine(i.spike)] : []),
        facts(i),
        ...(i.topEndpoint ? [`Most often on ${i.topEndpoint}`] : []),
        ...(i.stack.length > 0 ? ["", ...i.stack.map((l) => "    " + l)] : []),
        ...(link ? [`Open: ${link}`] : []),
        "",
      ];
    }),
    ...(input.more > 0 ? [`...and ${input.more} more.`, ""] : []),
    footerText(input.orgName),
  ].join("\n");

  return { subject: subjectFor(input), html, text };
}

export function renderTestEmail(input: {
  orgName: string;
  scope: string;
  /** Whether spike alerts are on too. */
  spikes?: boolean;
  dashboardUrl?: string;
}): AlertEmail {
  const heading = "Alerts are set up";
  const line =
    `You will get an email here when ${input.scope} reports an error BugBuster has not seen before` +
    (input.spikes ? ", or a known error suddenly happens far more often than usual." : ".");
  const link = input.dashboardUrl
    ? `<tr><td style="padding:0 0 16px;font-size:14px"><a href="${escapeHtml(input.dashboardUrl)}" style="color:${LINK};text-decoration:none;font-weight:600">Open BugBuster →</a></td></tr>`
    : "";
  return {
    subject: clip(`BugBuster test email for ${input.orgName}`, MAX_SUBJECT_CHARS),
    html: page(
      input.orgName,
      heading,
      `<tr><td style="padding:0 0 16px;font-size:15px;line-height:22px;color:${INK}">${escapeHtml(line)}</td></tr>` +
        link,
      escapeHtml(footerText(input.orgName)),
    ),
    text: [
      `${heading} for ${input.orgName}.`,
      "",
      line,
      ...(input.dashboardUrl ? ["", `Open BugBuster: ${input.dashboardUrl}`] : []),
      "",
      footerText(input.orgName),
    ].join("\n"),
  };
}
