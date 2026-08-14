import crypto from "crypto";

// Per-title credentials at rest.
//
// Smart SME kept its WordPress password, Mailchimp audience and outreach
// addresses in environment variables, which is fine for one title and
// impossible for twenty-five. They move into SiteCredential.payloadEnc, and
// this is the only place that can read them back.
//
// AES-256-GCM rather than CBC because it authenticates: a tampered ciphertext
// fails to decrypt rather than yielding plausible garbage that then gets used
// as a WordPress URL.

const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // GCM standard; 96 bits is what the mode is specified for
const KEY_BYTES = 32;

let cachedKey = null;

function key() {
  if (cachedKey) return cachedKey;

  const raw = process.env.CREDENTIAL_KEY;
  if (!raw) {
    throw new Error(
      "CREDENTIAL_KEY is not set. Per-title credentials cannot be read or written without it.\n" +
        "Generate one with:\n" +
        "  node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"\n" +
        "and put it in .env as CREDENTIAL_KEY."
    );
  }

  const buf = Buffer.from(raw, "base64");
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `CREDENTIAL_KEY must be ${KEY_BYTES} bytes base64-encoded, got ${buf.length}. ` +
        "A truncated key silently weakens every credential in the database, so this fails closed."
    );
  }

  cachedKey = buf;
  return cachedKey;
}

/** True when the key is present and usable — lets callers degrade rather than crash. */
export function isCryptoConfigured() {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypt a plain object. Returns "v1.<iv>.<tag>.<ciphertext>", all base64url.
 *
 * The version prefix is here so a future key rotation or algorithm change can
 * be detected per row rather than guessed at — without it, re-keying means
 * decrypting everything and hoping nothing was written in the old format
 * mid-migration.
 */
export function encryptJson(obj) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const plaintext = Buffer.from(JSON.stringify(obj ?? {}), "utf8");
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

/** Reverse of encryptJson. Throws on a tampered or truncated payload. */
export function decryptJson(blob) {
  if (!blob) return {};
  const parts = String(blob).split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Credential payload is not in the expected v1 format");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]);
  return JSON.parse(pt.toString("utf8"));
}

/**
 * What the settings UI is allowed to see: which fields are set, never what they
 * hold. A decrypted application password in a React prop is a credential in the
 * page source, so the redaction happens here rather than being remembered at
 * every call site.
 */
export function redact(payload) {
  const out = {};
  for (const [k, v] of Object.entries(payload || {})) {
    if (v == null || v === "") {
      out[k] = null;
    } else if (/pass|secret|token|key/i.test(k)) {
      out[k] = "••••••••";
    } else {
      // Non-secret identifiers (a WordPress URL, a GA4 property id) are useful
      // to see at a glance and are not sensitive on their own.
      out[k] = String(v);
    }
  }
  return out;
}
