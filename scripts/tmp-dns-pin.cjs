// Preload: pin barberingbusiness.com to its real SiteGround IP for this
// process. The local resolver still serves GoDaddy parking IPs cached from
// before the nameserver flip, and fetch() picking one of those turned the
// batch publisher's first WP call into a 403 off a parking page.
// Delete once the stale cache has expired.
const dns = require("dns");
const PIN = { "barberingbusiness.com": "35.214.93.13" };

const origLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  const pinned = PIN[hostname];
  if (!pinned) return origLookup.call(dns, hostname, options, callback);
  const rec = { address: pinned, family: 4 };
  process.nextTick(() => {
    if (options && options.all) callback(null, [rec]);
    else callback(null, pinned, 4);
  });
};
