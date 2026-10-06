import { getGoogleAccessToken } from "../lib/google.js";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const users = ["jb@airportbusinessmagazine.com", "jb@thefleetmagazine.co.uk", "jb@golfresortmagazine.com", "jb@barberingbusiness.com"];
for (const u of users) {
  const token = await getGoogleAccessToken(["https://www.googleapis.com/auth/gmail.settings.basic","https://www.googleapis.com/auth/gmail.settings.sharing"], u);
  const api = async (p) => {
    const r = await fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token}` } });
    const t = await r.text(); const j = t ? JSON.parse(t) : {};
    if (!r.ok) throw new Error(`${r.status} ${j?.error?.message || t.slice(0, 120)}`);
    return j;
  };
  const auto = await api("/settings/autoForwarding").catch((e) => ({ error: e.message }));
  const addrs = await api("/settings/forwardingAddresses").catch((e) => ({ error: e.message }));
  console.log(`${u}: auto=${JSON.stringify(auto)} addresses=${JSON.stringify(addrs.forwardingAddresses || addrs.error)}`);
}
