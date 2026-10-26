/**
 * Check every curated domain actually exists, then find its press page.
 *
 * A list Lucas has to click through is only worth the time if the links work,
 * so nothing ships unverified: the root has to answer, and the press path has
 * to answer and look like a press page rather than a soft 404.
 *
 * Run: node --env-file=.env scripts/_verify.mjs <slug> [...]
 */
import fs from "node:fs";

const SP = "C:/Users/CIMLTD~1/AppData/Local/Temp/claude/C--Users-CIM-Ltd--claude/4d94a2cb-8821-4431-8eeb-247162b58b8a/scratchpad";
const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36" };
const PATHS = ["/news", "/press", "/newsroom", "/media", "/press-releases", "/news-and-media", "/about/news", "/company/news", "/blog"];
const CONCURRENCY = 8;

async function get(url, ms = 12000) {
  try {
    const res = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(ms) });
    const text = res.ok ? (await res.text()).slice(0, 60000) : "";
    return { ok: res.ok, status: res.status, url: res.url, text };
  } catch {
    return { ok: false, status: 0, url, text: "" };
  }
}

// A press page names its own content. A soft 404 or a homepage redirect does not.
const looksLikePress = (html, finalUrl, root) => {
  if (!/press release|news release|media centre|media center|newsroom|latest news|press office|in the news/i.test(html)) return false;
  try {
    if (new URL(finalUrl).pathname.replace(/\/$/, "") === "") return false;
  } catch { return false; }
  return new URL(finalUrl).hostname.replace(/^www\./, "").endsWith(root.split(".").slice(-2).join("."));
};

// A refusal is not an absence. Pebble Beach, Callaway and The Belfry all answer
// a script with 403, and dropping them would be worse than useless. Anything
// that ANSWERS exists; only a connection that goes nowhere is treated as dead.
// DNS would be the cleaner test but this machine has no resolver of its own.
async function reach(domain) {
  for (const host of [domain, `www.${domain}`]) {
    const r = await get(`https://${host}/`);
    if (r.status > 0) return r;
  }
  return { ok: false, status: 0, url: "", text: "" };
}

async function check(row) {
  const root = await reach(row.domain);
  if (!root.status) return { ...row, live: false };
  const out = { ...row, live: true, site: root.ok ? root.url : `https://${row.domain}/`, blocked: !root.ok };
  if (!root.ok) return out;
  for (const path of PATHS) {
    const r = await get(new URL(path, root.url).href, 9000);
    if (r.ok && looksLikePress(r.text, r.url, row.domain)) { out.press = r.url; break; }
  }
  return out;
}

for (const slug of process.argv.slice(2)) {
  const rows = JSON.parse(fs.readFileSync(`${SP}/curated-${slug}.json`, "utf8"));
  const done = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < rows.length) {
        const row = rows[i++];
        done.push(await check(row));
        if (done.length % 20 === 0) console.log(`  ${slug} ${done.length}/${rows.length}`);
      }
    })
  );
  const live = done.filter((d) => d.live);
  const withPress = live.filter((d) => d.press);
  fs.writeFileSync(`${SP}/verified-${slug}.json`, JSON.stringify(done, null, 1));
  console.log(`${slug}: ${rows.length} checked, ${live.length} live, ${withPress.length} with a press page found, ${rows.length - live.length} dead and dropped`);
}
