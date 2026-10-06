// Every email address published on the five title sites, page by page.
const SITES = {
  "Smart SME": "https://smartsme.co.uk",
  "Fleet": "https://thefleetmagazine.co.uk",
  "Golf": "https://golfresortmagazine.com",
  "Barbering": "https://barberingbusiness.com",
  "Airports": "https://airportbusinessmagazine.com",
};
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36";
const RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const found = new Map();
for (const [name, base] of Object.entries(SITES)) {
  for (const type of ["pages", "posts"]) {
    let page = 1;
    while (page <= (type === "pages" ? 3 : 1)) {
      const url = `${base}/wp-json/wp/v2/${type}?per_page=100&page=${page}&_fields=id,link,title,content&status=publish`;
      let rows;
      try {
        const r = await fetch(url, { headers: { "User-Agent": UA } });
        if (!r.ok) { if (r.status !== 400) console.log(`${name} ${type} p${page}: HTTP ${r.status}`); break; }
        rows = await r.json();
      } catch (e) { console.log(`${name} ${type}: ${e.message}`); break; }
      if (!Array.isArray(rows) || !rows.length) break;
      for (const row of rows) {
        const html = `${row.content?.rendered || ""}`;
        for (const m of html.match(RE) || []) {
          const addr = m.toLowerCase();
          if (addr.endsWith(".png") || addr.endsWith(".jpg")) continue;
          const key = `${name}|${addr}`;
          if (!found.has(key)) found.set(key, new Set());
          found.get(key).add(row.link);
        }
      }
      page++;
    }
  }
}
const byAddr = new Map();
for (const [key, links] of found) {
  const [site, addr] = key.split("|");
  if (!byAddr.has(addr)) byAddr.set(addr, []);
  byAddr.get(addr).push(`${site}: ${[...links].join(", ")}`);
}
for (const [addr, where] of [...byAddr].sort()) {
  console.log(`\n${addr}`);
  for (const w of where) console.log(`   ${w}`);
}
