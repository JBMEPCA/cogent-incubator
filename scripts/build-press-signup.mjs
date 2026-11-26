// Builds Lucas's press-list signup sheet. Kept in the repo rather than thrown
// away each time, because it has now been rebuilt three times on his feedback.
//
//   node --env-file=.env --import ./scripts/_register.mjs scripts/build-press-signup.mjs [outfile]
//
// What is deliberately NOT on the sheet:
//   Policy & tax            government departments, already scanned as feeds
//   Sector press            rival titles publish news, they do not send it
//   PR agency               request-press-lists.mjs emails those automatically
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const OUT = process.argv[2] || String.raw`C:\Users\CIMLTD~1\AppData\Local\Temp\claude\6534a909c87b076e\1c0f0ea1-29fc-4aa6-a7c3-00d092966f8d\scratchpad\press-signup.html`;

const TITLES = {
  "fm-weekly": { name: "FM Weekly", press: "press@fmweekly.com" },
  "data-centre-today": { name: "Data Centre Today", press: "press@datacentretoday.com" },
  "stadium-arena-business": { name: "Stadium and Arena Business", press: "press@stadiumarenabusiness.com" },
  "retail-business-magazine": { name: "Retail Business Magazine", press: "press@retailbusinessmagazine.com" },
  "travel-business-news": { name: "Travel Business News", press: "press@travelbusinessnews.com" },
};
const OFF_SHEET = new Set(["Policy & tax", "Sector press (competitor)", "PR agency"]);
const ORDER = ["Operator", "Retailer", "Contractor", "Supplier", "TMC", "Sector body", "Research", "Events"];
const catRank = (c) => { const i = ORDER.indexOf(c); return i === -1 ? ORDER.length : i; };

// A standing news search is a PrBrand too, and does not belong on a sheet of
// people to email. Excluding it needs BOTH halves: `NOT startsWith` is false
// for a NULL feedUrl in SQL's three-valued logic, not true, so on its own it
// drops every hand-added row — which is exactly how 108 operators vanished
// from version 3. lib/../scan-feeds has the same pairing and the same warning.
const NOT_A_SEARCH = { OR: [{ feedUrl: null }, { NOT: { feedUrl: { startsWith: "https://news.google.com" } } }] };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hostOf = (u) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return null; } };
// Lucas's wording: the company domain, then "press contact". A site: search
// finds a newsroom but not a named officer, and misses PR directories.
const findUrl = (host) => `https://www.google.com/search?q=${encodeURIComponent(`${host} press contact`)}`;

let total = 0, agencyCount = 0, added = 0;
const blocks = [];
for (const [slug, meta] of Object.entries(TITLES)) {
  const site = await prisma.site.findUnique({ where: { slug }, select: { id: true } });
  agencyCount += await prisma.prBrand.count({ where: { siteId: site.id, category: "PR agency" } });
  const rows = (await prisma.prBrand.findMany({
    where: { siteId: site.id, ...NOT_A_SEARCH, newsHubUrl: { not: null } },
    select: { id: true, name: true, website: true, newsHubUrl: true, category: true, notes: true },
  })).filter((r) => !OFF_SHEET.has(r.category));
  rows.sort((a, b) => catRank(a.category) - catRank(b.category) || a.name.localeCompare(b.name));
  total += rows.length;
  added += rows.filter((r) => String(r.notes || "").includes("26 Nov 2026")).length;

  let lastCat = null;
  const items = rows.map((r) => {
    const host = hostOf(r.newsHubUrl) || hostOf(r.website);
    const head = r.category !== lastCat ? `<li class="cat">${esc(r.category)}</li>` : "";
    lastCat = r.category;
    const isNew = String(r.notes || "").includes("26 Nov 2026");
    return `${head}<li class="row"><label><input type="checkbox" data-id="${esc(r.id)}"><span class="co">${esc(r.name)}${isNew ? '<span class="new">new</span>' : ""}</span></label>` +
      (host
        ? `<span class="links"><a href="${esc(findUrl(host))}" target="_blank" rel="noopener">find press contact</a><a class="muted" href="${esc(r.newsHubUrl)}" target="_blank" rel="noopener">${esc(host)}</a></span>`
        : `<span class="links muted">no website on file</span>`) + `</li>`;
  }).join("");

  blocks.push(`<section class="title-block">
    <div class="head"><h2>${esc(meta.name)}</h2><span class="count" data-for="${esc(slug)}">0 / ${rows.length}</span></div>
    <div class="useline"><span class="k">Sign up with</span><code>${esc(meta.press)}</code><button class="copy" data-copy="${esc(meta.press)}">Copy</button></div>
    <ul class="list" data-slug="${esc(slug)}">${items}</ul>
  </section>`);
}

const html = `<title>Press List Signups</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
  /* Layout: one column, a block per title, a flat checklist grouped by what
     kind of organisation it is, operators and brands first. */
  :root {
    --bg:#f6f7f9; --surface:#fff; --ink:#161a21; --muted:#5e6675; --line:#dde1e8;
    --accent:#1f4d8f; --accent-soft:#eaf0f9; --done:#2f6f4f; --done-soft:#e8f2ec;
    --warn:#8a4b12; --warn-soft:#fbf0e2;
    --sans:"Inter",system-ui,-apple-system,"Segoe UI",sans-serif;
    --display:"Space Grotesk",var(--sans); --mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg:#10131a; --surface:#171b24; --ink:#e8eaef; --muted:#99a1b2; --line:#2a3140;
      --accent:#7aa7e6; --accent-soft:#1b2535; --done:#7fc7a1; --done-soft:#16271f;
      --warn:#e0a76a; --warn-soft:#2a2015; color-scheme: dark;
    }
  }
  :root[data-theme="dark"] {
    --bg:#10131a; --surface:#171b24; --ink:#e8eaef; --muted:#99a1b2; --line:#2a3140;
    --accent:#7aa7e6; --accent-soft:#1b2535; --done:#7fc7a1; --done-soft:#16271f;
    --warn:#e0a76a; --warn-soft:#2a2015; color-scheme: dark;
  }
  body { background:var(--bg); color:var(--ink); font-family:var(--sans); font-size:15px; line-height:1.55; }
  .wrap { max-width:54rem; margin:0 auto;
    padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px));
    padding-block:2.25rem 4rem; display:flex; flex-direction:column; gap:1.75rem; }
  h1 { font-family:var(--display); font-size:clamp(1.55rem,5vw,2rem); font-weight:700; letter-spacing:-0.02em; line-height:1.15; margin:0; text-wrap:balance; }
  h2 { font-family:var(--display); font-size:1.05rem; font-weight:600; margin:0; }
  p { margin:0; max-width:64ch; }
  .lede { color:var(--muted); }
  .eyebrow { font-size:0.7rem; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:var(--accent); }
  header { display:flex; flex-direction:column; gap:0.6rem; }
  section { background:var(--surface); border:1px solid var(--line); border-radius:10px; padding:1.15rem; display:flex; flex-direction:column; gap:0.9rem; }
  ol.steps { margin:0; padding-left:1.4rem; display:flex; flex-direction:column; gap:0.5rem; }
  .note { border-left:3px solid var(--warn); background:var(--warn-soft); border-radius:0 6px 6px 0; padding:0.7rem 0.85rem; font-size:0.9rem; }
  .note b { color:var(--warn); }
  code { font-family:var(--mono); font-size:0.85rem; }
  .title-block > .head { display:flex; justify-content:space-between; align-items:baseline; gap:0.75rem; flex-wrap:wrap; }
  .count { font-family:var(--mono); font-size:0.8rem; color:var(--muted); font-variant-numeric:tabular-nums; }
  .count[data-complete="yes"] { color:var(--done); font-weight:600; }
  .useline { display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap; background:var(--accent-soft); border-radius:7px; padding:0.5rem 0.7rem; }
  .useline .k { font-size:0.78rem; text-transform:uppercase; letter-spacing:0.06em; color:var(--accent); font-weight:600; }
  ul.list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; }
  li.cat { font-size:0.72rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--muted); font-weight:600; margin-top:0.9rem; padding-bottom:0.25rem; border-bottom:1px solid var(--line); }
  li.cat:first-child { margin-top:0; }
  li.row { display:flex; justify-content:space-between; align-items:baseline; gap:0.75rem; padding:0.42rem 0; border-bottom:1px solid var(--line); flex-wrap:wrap; }
  li.row label { display:flex; gap:0.55rem; align-items:baseline; cursor:pointer; min-width:0; flex:1 1 18rem; }
  li.row input { flex:none; width:1rem; height:1rem; accent-color:var(--accent); cursor:pointer; }
  li.row .co { min-width:0; overflow-wrap:anywhere; }
  li.row:has(input:checked) .co { color:var(--muted); text-decoration:line-through; }
  .new { font-size:0.62rem; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; color:var(--done);
    background:var(--done-soft); border-radius:3px; padding:0.05rem 0.3rem; margin-left:0.45rem; vertical-align:0.08em; }
  li.row:has(input:checked) .new { display:none; }
  .links { display:flex; gap:0.75rem; align-items:baseline; font-size:0.82rem; flex:none; }
  .links a { color:var(--accent); }
  .links .muted { color:var(--muted); font-family:var(--mono); font-size:0.78rem; }
  button.copy, button.ghost { font-family:var(--sans); font-size:0.72rem; font-weight:600; letter-spacing:0.04em; text-transform:uppercase;
    color:var(--accent); background:var(--surface); border:1px solid var(--line); border-radius:5px; padding:0.22rem 0.5rem; cursor:pointer; white-space:nowrap; }
  button.copy:hover, button.ghost:hover { border-color:var(--accent); }
  button.copy:focus-visible, button.ghost:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  button[data-state="ok"] { color:var(--done); border-color:var(--done); }
  .toolbar { display:flex; gap:0.6rem; align-items:center; flex-wrap:wrap; }
  .total { font-family:var(--mono); font-size:0.85rem; font-variant-numeric:tabular-nums; }
  footer { color:var(--muted); font-size:0.85rem; }
</style>

<div class="wrap">
  <header>
    <span class="eyebrow">Cogent &middot; for Lucas &middot; version 3</span>
    <h1>Get the five new titles onto press lists</h1>
    <p class="lede">${total} organisations across the five titles, operators and brands first. Each title has its own press address, and anything good that arrives is written up and published automatically.</p>
  </header>

  <section>
    <h2>What changed, and your ticks are safe</h2>
    <p><strong>${added} operators and brands added.</strong> You were right that the venues and the big names were missing — Stadium had eighteen entries and not one stadium. It now has Wembley, the O2, Co-op Live, the AO Arena, ExCeL and the rest. Retail has Tesco, Sainsbury's, Asda, Morrisons, the symbol groups and the wholesalers. Data Centre has VIRTUS, Ark, Telehouse, Vantage and the other operators. FM has Mitie, ISS, Sodexo, CBRE and Serco. Travel has the airlines, airports, rail operators and hotel groups.</p>
    <p>They are marked <span class="new">new</span> and sort to the top of each title, so you can go straight at them. The tag disappears once you tick it.</p>
    <p><strong>Find press contact</strong> now searches the company's domain plus "press contact", as you asked, rather than looking only inside their own site for a newsroom. It should turn up named contacts and agency listings as well as press pages.</p>
    <div class="note"><b>Your ticks are still there.</b> Nothing already on the list was renamed or removed, so the roughly forty you have done stay ticked. Only new rows were added.</div>
  </section>

  <section>
    <h2>How to do one</h2>
    <ol class="steps">
      <li>Pick a title block and copy its <strong>press address</strong> once; every signup in that block uses the same one.</li>
      <li>Click <strong>find press contact</strong>, then sign up on the press page or email the contact asking to be added to the distribution list.</li>
      <li>Tick it off. Ticks save in your browser, so you can stop and come back.</li>
    </ol>
    <div class="note"><b>Use the right address per title.</b> A release about data centres sent to the FM Weekly address lands on the wrong magazine. The address is the only thing that tells the system which title a release belongs to.</div>
  </section>

  <section>
    <h2>Progress</h2>
    <div class="toolbar">
      <span class="total" id="overall">0 / ${total} done</span>
      <button class="ghost" id="copyDone">Copy completed list</button>
      <button class="ghost" id="reset">Reset ticks</button>
    </div>
    <p class="lede" style="font-size:0.85rem">Send the completed list to JB when you stop. Resetting clears only the ticks on this page. ${agencyCount} PR agencies are handled by an automated job and are deliberately not on here.</p>
  </section>

${blocks.join("\n")}

  <footer>Rebuilt ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. Government departments and rival trade titles are left off on purpose: the first are already pulled in as news feeds every day, the second publish news rather than send it.</footer>
</div>

<script>
  var KEY = "cogent-press-signup-v1";
  function load(){ try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch(e){ return {}; } }
  function save(s){ try { localStorage.setItem(KEY, JSON.stringify(s)); } catch(e){} }
  var state = load();
  var boxes = Array.prototype.slice.call(document.querySelectorAll('input[type="checkbox"]'));
  boxes.forEach(function(b){ if (state[b.getAttribute("data-id")]) b.checked = true; });
  function refresh(){
    var done = 0;
    document.querySelectorAll("ul.list").forEach(function(ul){
      var all = ul.querySelectorAll('input[type="checkbox"]');
      var n = ul.querySelectorAll('input[type="checkbox"]:checked').length;
      done += n;
      var c = document.querySelector('.count[data-for="' + ul.getAttribute("data-slug") + '"]');
      if (c){ c.textContent = n + " / " + all.length; c.setAttribute("data-complete", n === all.length && all.length ? "yes" : "no"); }
    });
    document.getElementById("overall").textContent = done + " / " + boxes.length + " done";
  }
  boxes.forEach(function(b){
    b.addEventListener("change", function(){
      var id = b.getAttribute("data-id");
      if (b.checked) state[id] = 1; else delete state[id];
      save(state); refresh();
    });
  });
  function flash(btn, word){
    var old = btn.textContent;
    btn.textContent = word; btn.setAttribute("data-state","ok");
    setTimeout(function(){ btn.textContent = old; btn.removeAttribute("data-state"); }, 1600);
  }
  document.querySelectorAll("button.copy").forEach(function(btn){
    btn.addEventListener("click", function(){
      var text = btn.getAttribute("data-copy") || "";
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function(){ flash(btn,"Copied"); }, function(){ sel(btn); });
      } else { sel(btn); }
    });
  });
  function sel(btn){
    var el = btn.parentNode.querySelector("code");
    if (!el) return;
    try { var r = document.createRange(); r.selectNodeContents(el);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); flash(btn,"Selected"); } catch(e){}
  }
  document.getElementById("copyDone").addEventListener("click", function(){
    var lines = [];
    document.querySelectorAll("ul.list").forEach(function(ul){
      var slug = ul.getAttribute("data-slug");
      ul.querySelectorAll('input[type="checkbox"]:checked').forEach(function(b){
        var co = b.parentNode.querySelector(".co");
        lines.push(slug + "," + b.getAttribute("data-id") + "," + (co ? co.textContent.replace(/new$/, "") : ""));
      });
    });
    var out = lines.length ? "slug,id,company\\n" + lines.join("\\n") : "nothing ticked yet";
    var btn = document.getElementById("copyDone");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(out).then(function(){ flash(btn,"Copied " + lines.length); }, function(){});
  });
  document.getElementById("reset").addEventListener("click", function(){
    state = {}; save(state);
    boxes.forEach(function(b){ b.checked = false; });
    refresh(); flash(document.getElementById("reset"), "Cleared");
  });
  refresh();
</script>
`;

fs.writeFileSync(OUT, html);
console.log("wrote", OUT);
console.log("rows:", total, "| newly added and tagged:", added, "| PR agencies handled separately:", agencyCount);
await prisma.$disconnect();
