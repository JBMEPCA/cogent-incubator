// Checks the rules that decide whose name goes on which face in the interview
// social overlays (lib/social-overlay/names.js). Every case here is either a
// real caption from a published interview or a way a guess could go wrong.
//
//   node scripts/check-social-overlay-names.mjs
import assert from "node:assert/strict";
import { subjectsFor, leftRight, namesOnlyThem, assignNames } from "../lib/social-overlay/names.js";

let failed = 0;
const check = (label, fn) => {
  try {
    fn();
    console.log(`ok    ${label}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${label}\n      ${e.message.split("\n").join("\n      ")}`);
  }
};

const face = (x, w = 100) => ({ x, y: 100, w, h: w * 1.3 });

// Who the piece is about.
check("headline names both people", () =>
  assert.deepEqual(subjectsFor({ headline: "Stefan White and Kevin Furlong on the big move", personName: "Stefan White" }), ["Stefan White", "Kevin Furlong"]));
check("headline spelling wins over the record's titles", () =>
  assert.deepEqual(subjectsFor({ headline: "Mark Williams on the leg nobody should hide", personName: "Dr Mark Owen Williams" }), ["Mark Williams"]));
check("joint record borrows the surname", () =>
  assert.deepEqual(subjectsFor({ headline: "", personName: "Oli and Emily Arnold" }), ["Oli Arnold", "Emily Arnold"]));

// Left and right.
check("A (left) and B", () =>
  assert.deepEqual(leftRight("<p>Kevin Furlong (left) and Stefan White. Picture: supplied</p>"), { left: "Kevin Furlong", right: "Stefan White" }));
check("A, right, with B", () =>
  assert.deepEqual(leftRight("Martyn Barklett-Judge, right, with King Charles III at St James&#8217;s Palace."), { left: "King Charles III", right: "Martyn Barklett-Judge" }));
check("A and B (right)", () => assert.deepEqual(leftRight("Brian Wilson and Fraser Wilson (right)"), { left: "Brian Wilson", right: "Fraser Wilson" }));
check("left to right", () => assert.deepEqual(leftRight("Left to right: Andy Gardner and Steve Henwood."), { left: "Andy Gardner", right: "Steve Henwood" }));
check("leading word is not part of the name", () =>
  assert.deepEqual(leftRight("Pictured Kevin Furlong (left) and Stefan White"), { left: "Kevin Furlong", right: "Stefan White" }));
check("no position words, no reading", () => assert.equal(leftRight("Brian Wilson, founder of Paterson Golf, with his son Fraser Wilson"), null));
check("three names, no reading", () => assert.equal(leftRight("Ann Lee (left), Bob Ray and Cat Day"), null));

// One person alone.
check("single person, company with 'and' in it", () =>
  assert.ok(namesOnlyThem("Brenda Sunley, Managing Director of Storage and Fulfilment Services", "Brenda Sunley", { company: "Storage and Fulfilment Services" })));
check("single person, job title with 'and' in it", () =>
  assert.ok(namesOnlyThem("Ela Konyardi, founder and director of Enchanted Lands Day Nursery", "Ela Konyardi")));
check("credit line is not a second person", () => assert.ok(namesOnlyThem("Rob Wood. Picture: Novo Cabelo and Friends", "Rob Wood")));
check("'with' means someone else is there", () => assert.ok(!namesOnlyThem("Martyn Barklett-Judge with King Charles III", "Martyn Barklett-Judge")));
check("a team is not one person", () => assert.ok(!namesOnlyThem("The West and Hunter team outside the shop", "Zamaine Ismail", { company: "West and Hunter" })));
check("caption must name them", () => assert.ok(!namesOnlyThem("Picture: supplied", "Simon Turner")));

// Putting it together.
check("one face, one person: tagged", () => {
  const r = assignNames({ faces: [face(400)], subjects: ["Arran Turner"], alt: "Arran Turner, director of Sorbus Finance, at his desk", caption: "", company: "Sorbus Finance" });
  assert.deepEqual(r.tags.map((t) => t.name), ["Arran Turner"]);
});
check("one face, caption only credits: alt decides", () => {
  const r = assignNames({ faces: [face(400)], subjects: ["Simon Turner"], alt: "Simon Turner, Engagement Manager at Driving for Better Business", caption: "Picture: supplied", company: "Driving for Better Business" });
  assert.equal(r.tags.length, 1, r.reason);
});
check("one face but two people named: nothing", () => {
  const r = assignNames({ faces: [face(400)], subjects: ["Martyn Barklett-Judge"], alt: "Martyn Barklett-Judge of Pet Remedy talking with King Charles III", caption: "" });
  assert.equal(r.tags.length, 0);
});
check("two faces, caption places them: both tagged in order", () => {
  const r = assignNames({ faces: [face(900, 150), face(370, 180)], subjects: ["Stefan White", "Kevin Furlong"], caption: "Kevin Furlong (left) and Stefan White. Picture: supplied", alt: "Kevin Furlong and Stefan White, owners of Elite Fitness" });
  assert.deepEqual(r.tags.map((t) => [t.name, t.face.x]), [["Kevin Furlong", 370], ["Stefan White", 900]]);
});
check("two faces, no positions: nothing", () => {
  const r = assignNames({ faces: [face(380), face(1050)], subjects: ["Fraser Wilson"], alt: "Brian Wilson, founder of Paterson Golf, with his son Fraser Wilson", caption: "" });
  assert.equal(r.tags.length, 0);
});
check("two faces, caption and alt disagree: nothing", () => {
  const r = assignNames({ faces: [face(380), face(1050)], subjects: ["Andy Gardner"], caption: "Andy Gardner (left) and Steve Henwood", alt: "Steve Henwood (left) and Andy Gardner" });
  assert.equal(r.tags.length, 0);
});
check("two faces placed, neither is the interviewee: nothing", () => {
  const r = assignNames({ faces: [face(380), face(1050)], subjects: ["Andy Gardner"], caption: "Ann Lee (left) and Bob Ray" });
  assert.equal(r.tags.length, 0);
});
check("three faces: nothing", () => {
  const r = assignNames({ faces: [face(100), face(500), face(900)], subjects: ["A B"], caption: "A B (left) and C D" });
  assert.equal(r.tags.length, 0);
});

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
