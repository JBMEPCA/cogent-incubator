// The five sections inside a title, shared by the desktop header and the
// phone sheet so the two can never disagree about what is where.
//
// Each section lands on its first sub-tab (`seg`) and stays lit across the
// rest of its sub-tabs (`also`). Grouped by what the work is for: making the
// content, getting it out and hearing back, measuring it, and selling around
// it. Settings is not a section; it sits with the utilities on the right.

export const SECTIONS = [
  { seg: "", label: "Dashboard" },
  { seg: "/content", label: "Content", also: ["/interviews"] },
  // Everything that leaves the building or comes back in. The inbox leads
  // because "has anyone written back?" is the question asked most often.
  { seg: "/mail", label: "Distribution", also: ["/newsletter", "/linkedin", "/outreach"] },
  { seg: "/analytics", label: "Analytics", also: ["/seo"] },
  { seg: "/crm", label: "Commercial", also: ["/advertisers"] },
];

/** Whether `rest` (the path below /s/[slug]) belongs to section `s`. */
export function sectionActive(s, rest) {
  if (s.seg === "") return rest === "/";
  // Matched on whole segments, so "/content" never claims a future
  // "/contents" page.
  return [s.seg, ...(s.also || [])].some((p) => rest === p || rest.startsWith(`${p}/`));
}
