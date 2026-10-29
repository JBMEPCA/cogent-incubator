// Google account photos for each title's jb@ user, which press@ shares as an
// alias. The photo is the animated square icon from the brand kit; Google keeps
// only its first frame, which is the plain icon.
//
//   node --env-file=.env --import ./scripts/_register.mjs scripts/set-profile-photos.mjs          dry run
//   node --env-file=.env --import ./scripts/_register.mjs scripts/set-profile-photos.mjs --apply
//
// Needs admin.directory.user on the service account's domain-wide delegation,
// acting as a super admin, and the Admin SDK API enabled in its Cloud project.
// Build the icons first: cogent-base-theme/scripts/brand/avatar-gif.mjs.
import fs from "node:fs";
import path from "node:path";
import { getGoogleAccessToken } from "../lib/google.js";

const APPLY = process.argv.includes("--apply");
const ADMIN = "jb@smartsme.co.uk";
const BRAND = "../cogent-base-theme/scripts/brand/dist";

const USERS = {
  "jb@smartsme.co.uk": "smart-sme",
  "jb@thefleetmagazine.co.uk": "fleet-magazine",
  "jb@golfresortmagazine.com": "golf-resort-magazine",
  "jb@barberingbusiness.com": "barbering-business",
  "jb@airportbusinessmagazine.com": "airport-business-magazine",
  "jb@gymbusinessnews.com": "gym-business-news",
  "jb@nurserydaily.com": "nursery-daily",
  "jb@seniorlifestylebusiness.com": "senior-lifestyle-business",
  "jb@dentalbusinessnews.com": "dental-business-news",
  "jb@smartfarmingnews.com": "smart-farming-news",
};

const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/admin.directory.user"], ADMIN);
let failures = 0;

for (const [user, slug] of Object.entries(USERS)) {
  const file = path.join(BRAND, slug, "avatar-animated.gif"); // Admin UI refuses GIFs; the API may too, then use profile-photos/*.png
  if (!fs.existsSync(file)) {
    console.log(`${user}  MISSING ${file}`);
    failures++;
    continue;
  }
  if (!APPLY) {
    console.log(`${user}  would upload ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
    continue;
  }
  // The Directory API wants web-safe base64.
  const photoData = fs.readFileSync(file).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
  const res = await fetch(`https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(user)}/photos/thumbnail`, {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ photoData, mimeType: "image/gif", width: 512, height: 512 }),
  });
  const body = await res.text();
  if (!res.ok) failures++;
  console.log(`${user}  ${res.ok ? "set" : `FAILED ${res.status} ${body.slice(0, 200)}`}`);
}

if (!APPLY) console.log("\nDry run. Rerun with --apply to upload.");
process.exit(failures ? 1 : 0);
