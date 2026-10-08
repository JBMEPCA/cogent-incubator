// Who a To Do can be assigned to, by initials, with a colour each so a glance
// down the list shows whose is whose. No database import, so the notepad
// (a client component) can use it. Add someone by adding a line.
export const TODO_PEOPLE = [
  { key: "JB", color: "#2f6bff" },
  { key: "LP", color: "#e0452b" },
  { key: "JD", color: "#12a150" },
  { key: "DW", color: "#8b5cf6" },
  { key: "TW", color: "#d97706" },
];

export const PERSON_KEYS = TODO_PEOPLE.map((p) => p.key);
