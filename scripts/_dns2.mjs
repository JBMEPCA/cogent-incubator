const doh = async (name, type) => {
  const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`, { headers: { accept: "application/dns-json" } });
  const j = await r.json(); return (j.Answer||[]).map(a => a.data);
};
for (const d of ["news.barberingbusiness.com","news.gymbusinessnews.com"]) {
  console.log(`\n=== ${d} ===`);
  console.log("  SPF:  ", (await doh(d,"TXT")).find(x=>/v=spf1/i.test(x)) || "none");
  console.log("  DKIM: ", (await doh(`k2._domainkey.${d}`,"CNAME"))[0] || (await doh(`k1._domainkey.${d}`,"CNAME"))[0] || "none");
  console.log("  DMARC:", (await doh(`_dmarc.${d}`,"TXT")).find(x=>/v=DMARC1/i.test(x)) || "inherits from root");
  console.log("  Spamhaus DBL:", (await doh(`${d}.dbl.spamhaus.org`,"A")).length ? "LISTED" : "not listed");
}
