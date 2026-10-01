// Who is in the picture, and which face is whose.
//
// A wrong name on a face is the worst thing this feature can do, far worse
// than no name at all, so everything here is built to say "not sure" rather
// than guess. A name is only ever pinned to a face when:
//
//   - there is exactly one face and the words under the picture name exactly
//     one person, who is the interviewee; or
//   - there are exactly two faces, side by side, and the caption or alt text
//     says in so many words who is on the left and who is on the right
//     ("Kevin Furlong (left) and Stefan White").
//
// Anything else, including three or more faces, gets no name tags. The
// overlay then carries the names as plain text that points at nobody.

const HONORIFICS = /^(dr|sir|dame|lord|lady|mr|mrs|ms|miss|mx|prof|professor|cllr|rev|captain|capt)\.?$/i;
const POST_NOMINALS = /\b(obe|mbe|cbe|kbe|dbe|frs|phd|mba|bsc|msc|ba|ma|fca|aca|acca|mp|qc|kc|jp)\b\.?/gi;

// One capitalised name word: "Joyner-Platt", "O'Neill", "McAllister", "III".
const WORD = "[A-Z][\\p{L}'’-]*";
// Two to four of them, optionally after a title: "Dr Mark Williams",
// "King Charles III". Lower-case particles keep "Ursula von der Leyen" whole.
const NAME = `(?:${WORD}\\s+)(?:(?:van|von|der|de|da|di|du|le|la|del)\\s+)*${WORD}(?:\\s+${WORD}){0,2}`;

const clean = (s) =>
  String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;|&#8212;|[–—]/g, ",")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

/** "Dr Mark Owen Williams OBE" -> "Mark Owen Williams". */
export function bareName(name) {
  const words = clean(name).replace(POST_NOMINALS, "").replace(/[,.]+$/, "").split(/\s+/).filter(Boolean);
  while (words.length > 1 && HONORIFICS.test(words[0])) words.shift();
  return words.join(" ");
}

const norm = (s) =>
  bareName(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z' -]/g, "")
    .trim();

/** Same person? First name and surname must both agree; middle names may differ. */
export function samePerson(a, b) {
  const x = norm(a).split(/\s+/);
  const y = norm(b).split(/\s+/);
  if (x.length < 2 || y.length < 2) return false;
  return x[0] === y[0] && x[x.length - 1] === y[y.length - 1];
}

/**
 * The people the article is about.
 *
 * The headline names them as the piece itself presents them ("Stefan White and
 * Kevin Furlong on the big move"), and that spelling is the one printed. The
 * interview record adds anyone the headline shortens away. Joint names in the
 * record ("Oli and Emily Arnold") borrow the shared surname.
 */
export function subjectsFor({ headline, personName }) {
  const out = [];
  const add = (n) => {
    const b = bareName(n);
    if (b.split(/\s+/).length >= 2 && !out.some((o) => samePerson(o, b))) out.push(b);
  };

  const lead = clean(headline).split(/\s+on\s+/i)[0];
  if (lead && lead !== clean(headline)) {
    for (const part of lead.split(/\s*(?:,|\band\b|&)\s*/)) {
      if (new RegExp(`^${NAME}$`, "u").test(part.trim())) add(part);
    }
  }

  const people = clean(personName).replace(POST_NOMINALS, "").split(/\s+(?:and|&)\s+/i).map((p) => p.trim()).filter(Boolean);
  const words = people.map((p) => bareName(p).split(/\s+/));
  const tail = [...words].reverse().find((w) => w.length >= 2)?.at(-1);
  for (const w of words) add(w.length >= 2 ? w.join(" ") : tail ? `${w[0]} ${tail}` : w[0]);

  return out;
}

// Words that mean somebody else is in the picture too.
const OTHERS =
  /\b(with|alongside|together|team|staff|colleagues?|family|wife|husband|sons?|daughters?|partners?|brothers?|sisters?|friends?|couple|group|crew|guests?|customers?|clients?|members|pupils|children|residents|patients|left|right|centre|center|l-r)\b|\band\s+(?:his|her|their|[A-Z])|\b[A-Z][\p{L}'’-]+\s*(?:&|and)\s+[A-Z]/u;

/**
 * Does this text describe a picture of this one person and nobody else?
 * Company names are removed first, so "West and Hunter" is not read as two
 * people; a job title like "founder and director" is lower case and never was.
 */
export function namesOnlyThem(text, person, { company } = {}) {
  let t = clean(text);
  if (!t) return false;
  const surname = bareName(person).split(/\s+/).at(-1);
  if (!new RegExp(`\\b${esc(surname)}\\b`, "iu").test(t)) return false;
  for (const c of [company].filter(Boolean)) t = t.replace(new RegExp(esc(clean(c)), "gi"), "the company");
  return !OTHERS.test(withoutCredit(t));
}

// The credit line names the supplier, not someone in the shot.
const withoutCredit = (t) => t.replace(/\b(picture|photo|photograph|image|credit)s?\s*(supplied\s+|courtesy\s+of\s+|taken\s+)?(by|:|of)[^.]*\.?/gi, "").trim();

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * An explicit left/right reading of a two-person picture, or null.
 *
 * Only these shapes are trusted, and only when they name exactly two people:
 *   "A (left) and B"        "A and B (right)"       "A (left) and B (right)"
 *   "A, left, with B"       "A, right, with B"
 *   "Left to right: A and B"      "From left, A and B"      "L-R: A, B"
 * Returns { left, right } as written in the text.
 */
export function leftRight(text) {
  const t = clean(text);
  if (!t) return null;
  const N = `(${NAME})`;
  const END = `(?=\\s*(?:[.;:!?]|,|$|\\s+(?:at|in|on|during|from|outside|inside|of|who|pictured|photographed)\\b))`;
  const P = (s) => `\\s*(?:\\(\\s*${s}\\s*\\)|,\\s*${s}\\s*,)`;
  const JOIN = `\\s+(?:and|&|with)\\s+`;

  const shapes = [
    [new RegExp(`${N}${P("left")}${JOIN}${N}(?:${P("right")})?${END}`, "u"), (m) => [m[1], m[2]]],
    [new RegExp(`${N}${P("right")}${JOIN}${N}(?:${P("left")})?${END}`, "u"), (m) => [m[2], m[1]]],
    [new RegExp(`${N}${JOIN}${N}${P("right")}${END}`, "u"), (m) => [m[1], m[2]]],
    [new RegExp(`${N}${JOIN}${N}${P("left")}${END}`, "u"), (m) => [m[2], m[1]]],
    [new RegExp(`(?:^|[.;]\\s*|\\b)(?:from\\s+)?(?:left\\s+to\\s+right|l\\s*-\\s*r|from\\s+left)\\s*[:,]?\\s*${N}\\s*(?:,|and|&)\\s*${N}${END}`, "iu"), (m) => [m[1], m[2]]],
  ];
  for (const [re, pick] of shapes) {
    const m = t.match(re);
    if (!m) continue;
    const [left, right] = pick(m).map(trimLead);
    if (!left || !right) return null;
    // A third name straight after ("A (left), B and C") means three people.
    const after = t.slice(m.index + m[0].length);
    if (new RegExp(`^\\s*(?:,|and|&)\\s*${NAME}`, "u").test(after)) return null;
    if (samePerson(left, right) || norm(left) === norm(right)) return null;
    return { left, right };
  }
  return null;
}

// A capitalised word that opens the sentence is not part of the name:
// "Pictured Kevin Furlong (left)" must read as Kevin Furlong. What is left has
// to look like a name, two to four words, or the reading is thrown away.
const LEAD_WORDS = new Set(
  "pictured picture photo above below here from left right owners owner founders founder co-founders co-founder directors director the and with friends brothers sisters husband wife".split(" ")
);
function trimLead(name) {
  const words = String(name).trim().split(/\s+/);
  while (words.length && LEAD_WORDS.has(words[0].toLowerCase())) words.shift();
  return words.length >= 2 && words.length <= 4 ? words.join(" ") : null;
}

/**
 * Pin names to faces, or decide not to.
 *
 * faces: [{x,y,w,h}] in picture pixels (background faces already removed).
 * Returns { tags: [{ name, face }], reason } where tags may be empty; reason
 * says why, for the dry run and the logs.
 */
export function assignNames({ faces, subjects, caption, alt, company }) {
  if (!subjects.length) return { tags: [], reason: "no named interviewee" };
  if (!faces.length) return { tags: [], reason: "no face found" };
  if (faces.length > 2) return { tags: [], reason: `${faces.length} faces` };

  if (faces.length === 1) {
    if (subjects.length !== 1) return { tags: [], reason: `1 face, ${subjects.length} people named` };
    const person = subjects[0];
    // A caption that is only a credit ("Picture: supplied") says nothing about
    // who is in the shot, so it neither confirms nor contradicts.
    const texts = [caption, alt].map(clean).filter((t) => withoutCredit(t).length > 3);
    if (!texts.length) return { tags: [], reason: "no caption or alt text to confirm who is pictured" };
    // Every description we hold must agree it is this one person, alone.
    if (!texts.every((t) => namesOnlyThem(t, person, { company })))
      return { tags: [], reason: "caption does not confirm one person, the interviewee" };
    return { tags: [{ name: person, face: faces[0] }], reason: "one face, one named person" };
  }

  // Two faces.
  const [a, b] = [...faces].sort((p, q) => p.x + p.w / 2 - (q.x + q.w / 2));
  if (b.x < a.x + a.w * 0.6) return { tags: [], reason: "two faces not side by side" };
  if (Math.min(a.w, b.w) / Math.max(a.w, b.w) < 0.5) return { tags: [], reason: "two faces of very different sizes" };

  const readings = [caption, alt].map(leftRight).filter(Boolean);
  if (!readings.length) return { tags: [], reason: "two faces, caption gives no left and right" };
  const [lr] = readings;
  if (readings.some((r) => !samePerson(r.left, lr.left) || !samePerson(r.right, lr.right)))
    return { tags: [], reason: "caption and alt text disagree on who is where" };
  // The interviewee has to be one of the two; otherwise the caption is about
  // some other picture.
  if (!subjects.some((s) => samePerson(s, lr.left) || samePerson(s, lr.right)))
    return { tags: [], reason: "the people the caption places are not the interviewee" };

  const display = (n) => subjects.find((s) => samePerson(s, n)) || bareName(n);
  return {
    tags: [
      { name: display(lr.left), face: a },
      { name: display(lr.right), face: b },
    ],
    reason: "two faces, placed left and right by the caption",
  };
}
