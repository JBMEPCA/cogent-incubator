const key = process.env.PEXELS_API_KEY;
const queries = process.argv.slice(2);
for (const q of queries) {
  const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=8&orientation=landscape`, { headers: { authorization: key } });
  const j = await res.json();
  console.log(`\n## ${q}`);
  for (const p of j.photos || []) console.log(`${String(p.id).padStart(9)} ${(p.alt || "").slice(0, 70)} | ${p.src.large2x}`);
}
