import { getGoogleAccessToken } from "../lib/google.js";
for (const u of ["jb@thefleetmagazine.co.uk","jb@golfresortmagazine.com","jb@barberingbusiness.com","jb@airportbusinessmagazine.com","jb@gymbusinessnews.com","jb@nurserydaily.com","jb@smartfarmingnews.com","jb@seniorlifestylebusiness.com","jb@dentalbusinessnews.com"]) {
  const t = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.settings.basic"], u);
  const h = { Authorization: `Bearer ${t}` };
  const a = await (await fetch("https://gmail.googleapis.com/gmail/v1/users/me/settings/forwardingAddresses",{headers:h})).json();
  const f = await (await fetch("https://gmail.googleapis.com/gmail/v1/users/me/settings/autoForwarding",{headers:h})).json();
  console.log(u, JSON.stringify(a.forwardingAddresses), JSON.stringify(f));
}
