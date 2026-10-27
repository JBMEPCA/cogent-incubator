import { prisma } from "./prisma";

// The fleet-wide switches for things that run on their own, gathered in one
// place for App settings → Automations.
//
// Each one was already a GlobalSetting read by its own module, with its own
// default, and none had a screen: changing one meant a database edit. This file
// owns the list and how each value reads; the modules that act on them keep
// their own readers (trending.autoCommissionOn, press-intake.linkAskMode,
// social-overlay.overlaysOn), which read the same keys with the same defaults.
//
// Two are new: pauses for the eNewsletters and the subscriber drip. Those were
// Vercel variables only (NEWSLETTER_ENABLED, DRIP_ENABLED), which take a
// redeploy to change. The variable still works as before; the pause sits on
// top, so either one stops the send.

export const AUTOMATIONS = [
  {
    key: "pause_newsletters",
    label: "eNewsletters",
    detail: "The Monday briefing and the Thursday weekly, on every title.",
    options: [
      { value: "off", label: "Sending" },
      { value: "on", label: "Paused" },
    ],
    fallback: "off",
    env: "NEWSLETTER_ENABLED",
  },
  {
    key: "pause_drip",
    label: "Subscriber drip",
    detail: "The weekly top-up of new subscribers into each title's Mailchimp list.",
    options: [
      { value: "off", label: "Running" },
      { value: "on", label: "Paused" },
    ],
    fallback: "off",
    env: "DRIP_ENABLED",
  },
  {
    key: "trending_autocommission",
    label: "Trending auto-commission",
    detail: "Commissions an article from a strong trending match on its own, at most three a title a day.",
    options: [
      { value: "on", label: "On" },
      { value: "off", label: "Off" },
    ],
    fallback: "off",
  },
  {
    key: "interview_overlays",
    label: "Interview social pictures",
    detail: "The branded picture made for each published interview's social posts. A title can still opt out in its own settings.",
    options: [
      { value: "on", label: "On" },
      { value: "off", label: "Off" },
    ],
    fallback: "off",
  },
  {
    key: "press_link_ask",
    label: "Press desk replies",
    detail: "What happens when a press release goes live: email the sender the link, leave it in press@ Drafts, or nothing.",
    options: [
      { value: "send", label: "Send" },
      { value: "draft", label: "Draft only" },
      { value: "off", label: "Off" },
    ],
    fallback: "draft",
  },
];

const BY_KEY = new Map(AUTOMATIONS.map((a) => [a.key, a]));

/** A stored value normalised to one of the automation's options. */
function normalise(a, raw) {
  const v = String(raw || "").trim().toLowerCase();
  return a.options.some((o) => o.value === v) ? v : a.fallback;
}

/** Every automation with its current value, for the settings page. */
export async function readAutomations() {
  const rows = await prisma.globalSetting.findMany({ where: { key: { in: AUTOMATIONS.map((a) => a.key) } } });
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  return AUTOMATIONS.map((a) => ({
    ...a,
    value: normalise(a, stored.get(a.key)),
    // The Vercel variable can still stop it regardless of the switch here.
    envOff: a.env ? process.env[a.env] === "false" : false,
  }));
}

export function automationSpec(key) {
  return BY_KEY.get(key) || null;
}

/**
 * Whether a pause switch is on. Fails OPEN: a database that can't be read
 * leaves sending to the Vercel variable, exactly as before this switch
 * existed, rather than silently cancelling a week's issues.
 */
export async function isPaused(key) {
  try {
    const row = await prisma.globalSetting.findUnique({ where: { key } });
    return String(row?.value || "").trim().toLowerCase() === "on";
  } catch {
    return false;
  }
}
