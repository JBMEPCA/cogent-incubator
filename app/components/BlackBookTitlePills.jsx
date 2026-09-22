import { shortTitle } from "@/lib/black-book-labels";

// The "Relevant to" picker, shared by the add form and the edit form.
//
// Pills rather than bare checkboxes: the input is visually hidden and the
// label lights up when checked (CSS :has). When All titles is on the
// individual pills grey out, and the server ignores them. `selected` is the
// contact's stored siteIds, where an empty list means all titles.
export default function BlackBookTitlePills({ sites, selected }) {
  const all = Array.isArray(selected) && selected.length === 0;
  const picked = new Set(selected || []);
  return (
    <fieldset className="field field-wide bb-titles">
      <legend className="micro">Relevant to</legend>
      <label className="bb-check bb-all">
        <input type="checkbox" name="allTitles" defaultChecked={all} />
        <span aria-hidden="true">🌍</span> All titles
      </label>
      {sites.map((s) => {
        const t = shortTitle(s.name);
        return (
          <label key={s.id} className="bb-check bb-site" title={s.name}>
            <input
              type="checkbox"
              name="siteIds"
              value={s.id}
              aria-label={s.name}
              defaultChecked={picked.has(s.id)}
            />
            <span aria-hidden="true">{t.emoji}</span> {t.label}
          </label>
        );
      })}
    </fieldset>
  );
}

/** True when the form has at least one title ticked, or All titles. */
export function hasTitle(form) {
  return !!form.querySelector('input[name="allTitles"]:checked, input[name="siteIds"]:checked');
}
