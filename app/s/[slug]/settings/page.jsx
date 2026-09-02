import Header from "@/app/components/Header";
import { notFound } from "next/navigation";
import { CREDENTIAL_KINDS, credentialSummary, getSite } from "@/lib/site";
import { isCryptoConfigured } from "@/lib/crypto";
import { isGoogleConfigured, googleServiceAccountEmail } from "@/lib/google";
import { spendStatus } from "@/lib/spend";
import {
  saveSiteCredential,
  testSiteCredential,
  clearSiteCredential,
  saveEngineSettings,
  toggleProvisioningStep,
} from "@/lib/actions";
import { forSite } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Where a title's integrations are entered.
//
// Everything on this page obeys one rule: a stored secret is never sent to the
// browser. Fields show whether they are set, not what they hold, and a blank
// input on save means "leave it" rather than "clear it" — see saveSiteCredential.
//
// Saving always probes. A credential that has been typed but never tested is
// the state this whole screen exists to abolish: it looks configured, reads as
// done, and fails at 6am when the Editor tries to publish.

const SURFACE = { background: "var(--surface-2, #111a36)", border: "1px solid rgba(255,255,255,.07)" };

// Human labels and input hints. The field names themselves are terse because
// they are also the JSON keys in the encrypted payload.
const FIELD_META = {
  url: { label: "Site URL", placeholder: "https://smartsme.co.uk", type: "url" },
  username: { label: "Username", placeholder: "smartsme" },
  appPassword: { label: "Application password", secret: true, placeholder: "xxxx xxxx xxxx xxxx xxxx xxxx" },
  gscSiteUrl: { label: "Search Console property", placeholder: "sc-domain:smartsme.co.uk" },
  ga4PropertyId: { label: "GA4 property id", placeholder: "123456789" },
  audienceId: { label: "Mailchimp audience id", placeholder: "707a3f613c" },
  fromEmail: { label: "From address", type: "email", placeholder: "jb@smartsme.co.uk" },
  fromName: { label: "From name", placeholder: "James Burke" },
  replyTo: { label: "Reply-to", type: "email", placeholder: "same as the from address" },
  postalAddress: { label: "Postal address (email footer)", placeholder: "Cogent Multimedia Ltd, ..." },
  accessToken: { label: "Access token", secret: true },
  refreshToken: { label: "Refresh token", secret: true },
  expiresAt: { label: "Expires", placeholder: "set by the OAuth callback" },
};

function Dot({ state }) {
  const colour = { ok: "#34d399", bad: "#f87171", warn: "#fbbf24", off: "rgba(255,255,255,.22)" }[state];
  return (
    <span
      style={{
        width: 9, height: 9, borderRadius: "50%", background: colour, display: "inline-block",
        boxShadow: state === "ok" ? "0 0 10px rgba(52,211,153,.8)" : state === "bad" ? "0 0 10px rgba(248,113,113,.7)" : "none",
      }}
    />
  );
}

// Four states, and the difference between the middle two is the point of the
// page: "stored but never proved" is not the same as "working".
function statusOf(entry) {
  if (!entry.configured) return { state: "off", text: "Not set" };
  if (entry.healthy === true) return { state: "ok", text: entry.lastError ? "Working, with a caveat" : "Working" };
  if (entry.healthy === false) return { state: "bad", text: "Failing" };
  return { state: "warn", text: "Stored, not yet tested" };
}

const when = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;

const INPUT = {
  width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8,
  border: "1px solid rgba(255,255,255,.12)", background: "rgba(0,0,0,.25)",
  color: "var(--text)", fontSize: 13.5,
};

function Switch({ name, label, hint, checked, warn }) {
  return (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "7px 0" }}>
      <input type="checkbox" name={name} defaultChecked={checked} style={{ marginTop: 3 }} />
      <span>
        <span style={{ fontSize: 13.5 }}>{label}</span>
        {hint && (
          <span style={{ display: "block", fontSize: 11.5, opacity: 0.5, color: warn ? "#fcd34d" : undefined }}>
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

function Fleet({ label, present, detail }) {
  return (
    <li style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 0" }}>
      <Dot state={present ? "ok" : "bad"} />
      <span style={{ fontSize: 13.5 }}>{label}</span>
      <span style={{ fontSize: 12, opacity: 0.5 }}>{detail || (present ? "set" : "missing")}</span>
    </li>
  );
}

export default async function SettingsPage({ params }) {
  const { slug } = await params;
  const site = await getSite(slug);
  if (!site) notFound();
  const siteRef = { id: site.id, slug: site.slug };

  const cryptoReady = isCryptoConfigured();
  const summary = cryptoReady ? await credentialSummary(site.id) : {};
  // Shown against the cap input: a budget you cannot see the current position
  // of is one you can only steer by guesswork.
  const budget = await spendStatus(site.id);

  // SiteProvisioningStep is tenanted, so it must go through forSite() — the
  // guard in lib/prisma.js refuses the bare client, which is how it should be.
  const steps = await forSite(site.id).siteProvisioningStep.findMany({
    orderBy: { sortOrder: "asc" },
  });
  const stepsDone = steps.filter((s) => s.done).length;
  const blockingLeft = steps.filter((s) => s.blocking && !s.done).length;

  return (
    <>
      <Header />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px 60px" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 25 }}>Integrations</h1>
        <p style={{ fontSize: 13.5, opacity: 0.65, margin: "0 0 22px" }}>
          Per-title credentials for {site.name}. Values are encrypted before they are stored and are never
          shown again — saving runs a live test against the real service.
        </p>

        {!cryptoReady && (
          <section style={{ ...SURFACE, borderRadius: 12, padding: 16, marginBottom: 18, borderColor: "rgba(248,113,113,.45)" }}>
            <strong style={{ color: "#f87171" }}>CREDENTIAL_KEY is not set.</strong>
            <p style={{ fontSize: 13, opacity: 0.75, margin: "6px 0 0" }}>
              Nothing can be stored or read without it, so this page is disabled rather than writing secrets in
              plain text. Generate one with{" "}
              <code>node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;base64&apos;))&quot;</code>{" "}
              and set it in the environment.
            </p>
          </section>
        )}

        {steps.length > 0 && (
          <section style={{ ...SURFACE, borderRadius: 14, padding: "16px 18px", marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 14, textTransform: "uppercase", letterSpacing: ".06em", opacity: 0.6 }}>
                Provisioning
              </h2>
              <span style={{ fontSize: 12.5, opacity: 0.65, fontVariantNumeric: "tabular-nums" }}>
                {stepsDone} of {steps.length} done
                {blockingLeft > 0 && (
                  <span style={{ color: "#fbbf24" }}> · {blockingLeft} blocking outstanding</span>
                )}
              </span>
            </div>
            <p style={{ fontSize: 12.5, opacity: 0.55, margin: "6px 0 12px" }}>
              Jobs in consoles that have no useful API. <strong style={{ opacity: 0.85 }}>Blocking</strong> steps
              break something quietly if skipped, rather than loudly.
            </p>

            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 1 }}>
              {steps.map((step) => (
                <li key={step.id}>
                  <form action={toggleProvisioningStep.bind(null, siteRef)}>
                    <input type="hidden" name="key" value={step.key} />
                    <button
                      type="submit"
                      style={{
                        display: "flex", gap: 11, alignItems: "flex-start", width: "100%", textAlign: "left",
                        background: "transparent", border: 0, borderBottom: "1px solid rgba(255,255,255,.05)",
                        padding: "9px 2px", cursor: "pointer", color: "inherit", font: "inherit",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          flex: "none", width: 15, height: 15, marginTop: 2, borderRadius: 4,
                          border: `1.5px solid ${step.done ? "#34d399" : step.blocking ? "rgba(251,191,36,.75)" : "rgba(255,255,255,.28)"}`,
                          background: step.done ? "#34d399" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, color: "#0b1020", fontWeight: 700, lineHeight: 1,
                        }}
                      >
                        {step.done ? "✓" : ""}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{
                          fontSize: 13.5,
                          opacity: step.done ? 0.45 : 0.95,
                          textDecoration: step.done ? "line-through" : "none",
                        }}>
                          {step.label}
                        </span>
                        {step.blocking && !step.done && (
                          <span style={{
                            fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase",
                            color: "#fbbf24", border: "1px solid rgba(251,191,36,.4)", borderRadius: 3,
                            padding: "1px 5px", marginLeft: 8, whiteSpace: "nowrap",
                          }}>
                            Blocking
                          </span>
                        )}
                        {step.detail && !step.done && (
                          <span style={{ display: "block", fontSize: 12, opacity: 0.55, marginTop: 3 }}>
                            {step.detail}
                          </span>
                        )}
                      </span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section style={{ ...SURFACE, borderRadius: 12, padding: "14px 16px", marginBottom: 22 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 14, textTransform: "uppercase", letterSpacing: ".06em", opacity: 0.6 }}>
            Fleet-wide
          </h2>
          <p style={{ fontSize: 12.5, opacity: 0.55, margin: "0 0 8px" }}>
            Shared by every title and set in the environment, not here.
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            <Fleet label="Anthropic API key" present={Boolean(process.env.ANTHROPIC_API_KEY)} />
            <Fleet
              label="Google service account"
              present={isGoogleConfigured()}
              detail={googleServiceAccountEmail() || undefined}
            />
            <Fleet label="Pexels API key" present={Boolean(process.env.PEXELS_API_KEY)} />
            <Fleet label="Mailchimp API key" present={Boolean(process.env.MAILCHIMP_API_KEY)} />
            <Fleet label="LinkedIn app" present={Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET)} />
            <Fleet label="Credential key" present={cryptoReady} />
          </ul>
        </section>

        <section style={{ ...SURFACE, borderRadius: 14, padding: "16px 18px", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
            <Dot state={site.engineEnabled ? "ok" : "off"} />
            <h2 style={{ margin: 0, fontSize: 17 }}>Engine</h2>
            <span style={{ marginLeft: "auto", fontSize: 12.5, opacity: 0.65 }}>
              {site.engineEnabled ? "Running" : "Switched off"}
            </span>
          </div>
          <p style={{ fontSize: 12.5, opacity: 0.55, margin: "0 0 10px" }}>
            A title with the engine off is skipped by every scheduled job, so this is safe to set before
            the clock is pointed at this app.
          </p>

          <form action={saveEngineSettings.bind(null, siteRef)}>
            <Switch
              name="engineEnabled"
              label="Engine on"
              hint="Lets the agents run, spend and publish to the live site."
              checked={site.engineEnabled}
            />
            <Switch
              name="newsletterEnabled"
              label="Weekly newsletter"
              hint="Sends a real issue to the whole audience each Thursday."
              checked={site.newsletterEnabled}
              warn
            />
            <Switch
              name="linkedInEnabled"
              label="LinkedIn queue"
              hint="Drafting only. Nothing posts without approval, and without a connection it is copy-and-paste."
              checked={site.linkedInEnabled}
            />
            <Switch
              name="outreachEnabled"
              label="Backlink outreach"
              hint="Drafts AND sends on its own: queued drafts email real companies on the hourly sweep without approval. The Backlinks page is the override window before the next tick. Capped at 25 sends a day."
              checked={site.outreachEnabled}
              warn
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 12 }}>
              <label>
                <span style={{ display: "block", fontSize: 11.5, opacity: 0.6, marginBottom: 3 }}>
                  Daily spend cap (USD)
                </span>
                <input
                  name="dailySpendCapUsd"
                  type="number"
                  step="0.5"
                  min="0.5"
                  defaultValue={site.dailySpendCapUsd ?? ""}
                  placeholder="uncapped"
                  style={INPUT}
                />
                <span
                  className="micro"
                  style={{
                    display: "block",
                    marginTop: 3,
                    color: budget.over ? "var(--neon-amber)" : "var(--muted)",
                  }}
                >
                  {budget.capped
                    ? budget.over
                      ? `$${budget.spent.toFixed(2)} spent today — cap reached, agents paused`
                      : `$${budget.spent.toFixed(2)} spent today, $${budget.remaining.toFixed(2)} left`
                    : `$${budget.spent.toFixed(2)} spent today, no cap set`}
                </span>
              </label>
              <label>
                <span style={{ display: "block", fontSize: 11.5, opacity: 0.6, marginBottom: 3 }}>
                  Articles per day
                </span>
                {/* Whole articles only: slotsFor() rounds and clamps to 1-7, so a
                    step of 0.5 offered settings the scheduler could not honour. */}
                <input name="articlesPerDayTarget" type="number" step="1" min="1" max="7" defaultValue={site.articlesPerDayTarget} style={INPUT} />
              </label>
              <label>
                <span style={{ display: "block", fontSize: 11.5, opacity: 0.6, marginBottom: 3 }}>
                  Office hours start
                </span>
                <input name="officeHoursStart" type="number" min="0" max="23" defaultValue={site.officeHoursStart} style={INPUT} />
              </label>
              <label>
                <span style={{ display: "block", fontSize: 11.5, opacity: 0.6, marginBottom: 3 }}>
                  Office hours end
                </span>
                <input name="officeHoursEnd" type="number" min="0" max="23" defaultValue={site.officeHoursEnd} style={INPUT} />
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
              <button className="btn" type="submit">Save engine settings</button>
              <span style={{ fontSize: 11.5, opacity: 0.45 }}>
                Hours are {site.timezone} wall clock, so the clock change needs no edit.
              </span>
            </div>
          </form>
        </section>

        <div style={{ display: "grid", gap: 14 }}>
          {Object.entries(CREDENTIAL_KINDS).map(([kind, spec]) => {
            const entry = summary[kind] || { configured: false, fields: {} };
            const status = statusOf(entry);
            const checked = when(entry.checkedAt);

            return (
              <section key={kind} style={{ ...SURFACE, borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
                  <Dot state={status.state} />
                  <h2 style={{ margin: 0, fontSize: 17 }}>{spec.label}</h2>
                  {spec.required && (
                    <span className="micro" style={{ opacity: 0.5, border: "1px solid rgba(255,255,255,.15)", borderRadius: 20, padding: "1px 8px" }}>
                      required
                    </span>
                  )}
                  <span style={{ marginLeft: "auto", fontSize: 12.5, opacity: 0.65 }}>
                    {status.text}
                    {checked && <span style={{ opacity: 0.55 }}> · tested {checked}</span>}
                  </span>
                </div>

                {spec.note && <p style={{ fontSize: 12.5, opacity: 0.55, margin: "0 0 10px" }}>{spec.note}</p>}

                {entry.lastError && (
                  <p
                    style={{
                      fontSize: 12.5,
                      margin: "0 0 12px",
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: entry.healthy ? "rgba(251,191,36,.08)" : "rgba(248,113,113,.08)",
                      color: entry.healthy ? "#fcd34d" : "#fca5a5",
                    }}
                  >
                    {entry.lastError}
                  </p>
                )}

                <form action={saveSiteCredential.bind(null, siteRef, kind)}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
                    {spec.fields.map((field) => {
                      const meta = FIELD_META[field] || { label: field };
                      const current = entry.fields?.[field];
                      return (
                        <label key={field} style={{ display: "block" }}>
                          <span style={{ display: "block", fontSize: 11.5, opacity: 0.6, marginBottom: 3 }}>
                            {meta.label}
                          </span>
                          <input
                            name={field}
                            type={meta.secret ? "password" : meta.type || "text"}
                            autoComplete="off"
                            disabled={!cryptoReady}
                            // The placeholder carries the current value for
                            // non-secret fields and •••• for secrets, so an
                            // empty box reads as "unchanged" rather than blank.
                            placeholder={current || meta.placeholder || ""}
                            style={INPUT}
                          />
                        </label>
                      );
                    })}
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
                    <button className="btn" type="submit" disabled={!cryptoReady}>
                      Save and test
                    </button>
                    {entry.configured && (
                      <button
                        className="btn-ghost"
                        type="submit"
                        formAction={testSiteCredential.bind(null, siteRef, kind)}
                      >
                        Test again
                      </button>
                    )}
                    <span style={{ fontSize: 11.5, opacity: 0.45 }}>
                      Leave a field blank to keep what is already stored.
                    </span>
                  </div>
                </form>

                {entry.configured && (
                  <form action={clearSiteCredential.bind(null, siteRef)} style={{ marginTop: 8 }}>
                    <input type="hidden" name="kind" value={kind} />
                    <button className="btn-ghost" type="submit" style={{ fontSize: 12, opacity: 0.6 }}>
                      Remove
                    </button>
                  </form>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
