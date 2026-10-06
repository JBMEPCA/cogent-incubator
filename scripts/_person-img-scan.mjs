// Lists every candidate photo on a page with the text around it.
const urls = process.argv.slice(2);
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36";
for (const u of urls) {
  const html = await (await fetch(u, { headers: { "user-agent": UA } })).text();
  console.log("\n==", u, html.length);
  const og = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i);
  console.log("og:", og?.[1]);
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const t = m[0];
    const src = (t.match(/\s(?:data-lazy-src|data-src|src)=["']([^"']+)/i) || [])[1];
    if (!src || /logo|icon|avatar|gravatar|data:image|\.svg/i.test(src)) continue;
    const alt = (t.match(/alt=["']([^"']*)/i) || [])[1] || "";
    const w = (t.match(/width=["'](\d+)/i) || [])[1] || "";
    console.log(`- ${src} | alt="${alt}" w=${w}`);
  }
}
