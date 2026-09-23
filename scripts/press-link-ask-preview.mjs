// Read the link ask exactly as a sender would, for both shapes it takes, with
// no database and no mailbox.
import { replyLines } from "../lib/press-intake.js";

const cases = [
  {
    label: "THE REAL BARBERING ONE (agency: ajc93.com writing for Enki Towels)",
    site: { name: "Barbering Business" },
    to: { name: "Michaella Kay", email: "michaella@ajc93.com" },
    sorted: { company: "Enki Towels", companyWebsite: "https://enkitowels.com" },
    url: "https://barberingbusiness.com/sustainable-barbershop-checklist-6-changes-that-cost-nothing/",
  },
  {
    label: "DIRECT (brand writing from its own domain)",
    site: { name: "Gym Business News" },
    to: { name: "Sarah Whitlock", email: "sarah@playlist.com" },
    sorted: { company: "Playlist", companyWebsite: "https://playlist.com" },
    url: "https://gymbusinessnews.com/playlist-launches-ai-insights-for-fitness-and-wellness-operators/",
  },
  {
    label: "NO NAME (shared inbox)",
    site: { name: "The Fleet Magazine" },
    to: { name: "", email: "press@brake.org.uk" },
    sorted: { company: "Brake", companyWebsite: "https://brake.org.uk" },
    url: "https://thefleetmagazine.co.uk/more-than-400-killed-or-seriously-injured-in-crashes-linked-to-mobile-use/",
  },
];

for (const c of cases) {
  console.log("\n" + "=".repeat(78) + "\n" + c.label + "\n" + "=".repeat(78));
  console.log(replyLines(c).join("\n"));
}
