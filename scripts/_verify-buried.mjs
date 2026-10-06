/** One-off: is 1017 live, and is it absent from the front page? */
const URL = "https://smartsme.co.uk/sustainability-without-pretending-to-be-perfect/";
const ua = { "user-agent": "Mozilla/5.0 (verify-check)", "cache-control": "no-cache" };
const art = await fetch(URL, { headers: ua });
const artHtml = await art.text();
console.log(`article: HTTP ${art.status}, title present: ${/Sustainability without pretending to be perfect/i.test(artHtml)}, byline: ${/Dean Butt/.test(artHtml)}`);
const home = await fetch(`https://smartsme.co.uk/?nocache=${Date.now()}`, { headers: ua });
const homeHtml = await home.text();
const hits = (homeHtml.match(/sustainability-without-pretending-to-be-perfect/g) || []).length;
console.log(`homepage: HTTP ${home.status}, ${homeHtml.length} bytes, mentions of the slug: ${hits}`);
const lead = homeHtml.match(/hero-feature[\s\S]*?<h1[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
console.log(`homepage lead: ${lead ? lead[1].trim() : "(could not parse)"}`);
const ops = homeHtml.match(/cat-section--operations[\s\S]*?<\/div>\s*<\/div>/);
const opsTitles = ops ? [...ops[0].matchAll(/<h3[^>]*>\s*<a[^>]*>([^<]+)<\/a>/g)].map((m) => m[1].trim()) : [];
console.log(`operations section: ${opsTitles.length ? opsTitles.join(" | ") : "(not parsed)"}`);
console.log(hits === 0 ? "BURIED OK" : "STILL ON HOMEPAGE");
