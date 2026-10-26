// DNS over HTTPS, because raw DNS is blocked from this machine.
const doh = async (name, type) => {
  const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`, { headers: { accept: "application/dns-json" } });
  const j = await r.json();
  return { status: j.Status, answers: (j.Answer||[]).map(a => a.data) };
};
const DOMAINS = ["barberingbusiness.com","smartsme.co.uk","gymbusinessnews.com"];
for (const d of DOMAINS) {
  console.log(`\n=== ${d} ===`);
  const spf = await doh(d, "TXT");
  console.log("  SPF:   ", (spf.answers.find(x=>/v=spf1/i.test(x))||"none").slice(0,120));
  const dm = await doh(`_dmarc.${d}`, "TXT");
  console.log("  DMARC: ", (dm.answers.find(x=>/v=DMARC1/i.test(x))||"none").slice(0,120));
  const dk = await doh(`k1._domainkey.${d}`, "CNAME");
  console.log("  DKIM:  ", dk.answers[0] || "none at k1._domainkey");
  // Spamhaus domain blocklist: an A record means listed.
  const dbl = await doh(`${d}.dbl.spamhaus.org`, "A");
  console.log("  Spamhaus DBL:", dbl.answers.length ? `LISTED ${dbl.answers.join(",")}` : "not listed");
  const sem = await doh(`${d}.fresh.spameatingmonkey.net`, "A").catch(()=>({answers:[]}));
  console.log("  SEM fresh:   ", sem.answers.length ? `LISTED ${sem.answers.join(",")}` : "not listed");
}
