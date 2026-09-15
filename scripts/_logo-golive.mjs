// One-off, 15 Sep 2026: after cogent-base 1.21.0 and the Fleet, Barbering and
// Airport child themes shipped their drawn mastheads, set each of those
// titles' WordPress site icon and Yoast publisher logo to the new artwork,
// purge every title's cache (the parent changed on all five), and prove from
// the server what each site now renders.
//
//   node --import ./scripts/_register.mjs scripts/_logo-golive.mjs [--verify-only]
import os from "node:os";
import { execFileSync } from "node:child_process";
import { prisma } from "../lib/prisma.js";
import { siteCredentials } from "../lib/site.js";

const VERIFY_ONLY = process.argv.includes("--verify-only");
const NEW_MARKS = new Set(["fleet-magazine", "barbering-business", "airport-business-magazine"]);

// Rendered on the host through wp eval-file, so it cannot be blocked by the
// SiteGround captcha and shows what PHP actually produces.
const PROBE = `<?php
ob_start(); do_action('wp_head'); $head = ob_get_clean();
$fav = 'NONE';
if (preg_match('/<link rel="icon" href="data:image\\/svg\\+xml,([^"]+)"/', $head, $m)) {
  $svg = rawurldecode($m[1]);
  $fav = strpos($svg, 'viewBox="0 0 1000 1000"') !== false ? 'artwork' : (strpos($svg, '<text') !== false ? 'split mark' : 'other');
}
$touch = preg_match('/rel="apple-touch-icon"[^>]*href="([^"]+)"/', $head, $t) ? basename($t[1]) : 'none';
$h = do_blocks(file_get_contents(get_stylesheet_directory() . '/parts/header.html'));
$f = do_blocks(file_get_contents(get_stylesheet_directory() . '/parts/footer.html'));
$kind = function ($html) { return strpos($html, 'logo-lockup--art') !== false ? 'artwork' : (strpos($html, 'logo-row') !== false ? 'typeset' : 'missing'); };
echo "versions  parent " . wp_get_theme(get_template())->get('Version') . ", child " . wp_get_theme()->get('Version') . "\\n";
echo "header    " . $kind($h) . "\\n";
echo "footer    " . $kind($f) . "\\n";
echo "menu      " . $kind(cogent_lockup_html()) . "\\n";
echo "tab icon  " . $fav . "\\n";
echo "site icon " . $touch . "\\n";
$t = get_option('wpseo_titles');
echo "publisher " . basename((string) ($t['company_logo'] ?? '')) . "\\n";
`;

const sites = await prisma.site.findMany({ orderBy: { createdAt: "asc" } });
for (const site of sites) {
  console.log(`\n=== ${site.name} ===`);
  const { creds } = await siteCredentials(site.id);
  const s = creds.sftp;
  const key = s.privateKeyPath.replace(/^~/, os.homedir());
  const docroot = s.themePath.replace(/\/wp-content\/themes\/.*$/, "");
  const ssh = (cmd, input) =>
    execFileSync("ssh", ["-i", key, "-o", "BatchMode=yes", "-p", String(s.port || 18765), `${s.username}@${s.host}`, cmd],
      { encoding: "utf8", timeout: 180000, input }).trim();

  if (!VERIFY_ONLY && NEW_MARKS.has(site.slug)) {
    const file = `${s.themePath}/assets/brand/avatar-512.png`;
    const id = ssh(`cd '${docroot}' && wp media import '${file}' --title='${site.name} logo' --alt='${site.name} logo' --porcelain 2>/dev/null`);
    if (!/^\d+$/.test(id)) {
      console.log(`  media import FAILED: ${id.slice(0, 200)}`);
      continue;
    }
    const url = ssh(`cd '${docroot}' && wp eval 'echo wp_get_attachment_url(${id});'`);
    ssh(`cd '${docroot}' && wp option update site_icon ${id}`);
    ssh(`cd '${docroot}' && wp option patch update wpseo_titles company_logo '${url}'`);
    ssh(`cd '${docroot}' && wp option patch update wpseo_titles company_logo_id ${id}`);
    console.log(`  logo imported as media #${id}; site icon and publisher logo now point at it`);
  }

  if (!VERIFY_ONLY) {
    ssh(`cd '${docroot}' && (wp sg purge 2>&1; wp cache flush 2>&1) | tail -2`);
    console.log("  cache purged");
  }

  const out = ssh(`cd '${docroot}' && cat > /tmp/_logo_probe.php && wp eval-file /tmp/_logo_probe.php 2>/dev/null; rm -f /tmp/_logo_probe.php`, PROBE);
  console.log(out.split("\n").map((l) => `  ${l}`).join("\n"));
}
await prisma.$disconnect();
process.exit(0);
