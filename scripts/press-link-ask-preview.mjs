// Read the link ask exactly as a sender would, for both shapes it takes, with
// no database and no mailbox. What the press desk will put in Drafts.
import { replyLines } from "../lib/press-intake.js";

const cases = [
  {
    label: "DIRECT — brand writes from its own domain",
    site: { name: "Gym Business News" },
    to: { name: "Sarah Whitlock", email: "sarah@playlist.com" },
    sorted: { company: "Playlist", companyWebsite: "https://playlist.com" },
    title: "Playlist launches AI Insights for fitness and wellness operators",
    url: "https://gymbusinessnews.com/playlist-launches-ai-insights-for-fitness-and-wellness-operators/",
  },
  {
    label: "AGENCY — PR firm writes on behalf of a client",
    site: { name: "Golf Resort Magazine" },
    to: { name: "Beth Kaye", email: "beth@theazaleagroup.com" },
    sorted: { company: "Rockliffe Hall", companyWebsite: "https://rockliffehall.com" },
    title: "Rockliffe sets sights on being the UK's leading luxury golf resort",
    url: "https://golfresortmagazine.com/rockliffe-sets-sights-on-being-uks-leading-luxury-golf-resort/",
  },
  {
    label: "NO NAME — release sent from a shared inbox",
    site: { name: "The Fleet Magazine" },
    to: { name: "", email: "press@brake.org.uk" },
    sorted: { company: "Brake", companyWebsite: "https://brake.org.uk" },
    title: "More than 400 killed or seriously injured in crashes linked to mobile phone use",
    url: "https://thefleetmagazine.co.uk/more-than-400-killed-or-seriously-injured-in-crashes-linked-to-mobile-use/",
  },
];

for (const c of cases) {
  console.log("\n" + "=".repeat(78));
  console.log(c.label);
  console.log("=".repeat(78));
  console.log(replyLines(c).join("\n"));
}
