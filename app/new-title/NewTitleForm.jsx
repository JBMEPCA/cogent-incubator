"use client";

import { useState } from "react";
import SiteMark from "../components/SiteMark";

// The form previews the mark as you type, because the mark is the only thing
// you will actually see in the rail once there are a dozen titles — deciding
// what it says is a real design decision, not a field to skip past.

const PRESETS = [
  ["#2e3eee", "#5a6aff"],
  ["#0891b2", "#22d3ee"],
  ["#059669", "#34f5c5"],
  ["#d97706", "#fbbf24"],
  ["#8b5cf6", "#a78bfa"],
  ["#c026d3", "#e879f9"],
];

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export default function NewTitleForm({ action, taken = [] }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [mark, setMark] = useState("");
  const [accent, setAccent] = useState(PRESETS[1][0]);
  const [accent2, setAccent2] = useState(PRESETS[1][1]);
  const [strapline, setStrapline] = useState("");

  const effectiveSlug = slug || slugify(name);
  const clash = effectiveSlug && taken.includes(effectiveSlug);

  const preview = {
    name: name || "New Title",
    markAccent: mark,
    accentHex: accent,
    accent2Hex: accent2,
    status: "setup",
  };

  return (
    <form action={action} className="newtitle">
      <section className="panel newtitle-main">
        <div className="newtitle-grid">
          <label className="field">
            <span className="micro">Title name</span>
            <input name="name" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Smart Manufacturing" autoComplete="off" required />
          </label>

          <label className="field">
            <span className="micro">URL slug</span>
            <input name="slug" value={effectiveSlug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              placeholder="smart-manufacturing" autoComplete="off" />
            {clash && <em className="field-err">Already used by another title</em>}
          </label>

          <label className="field field-wide">
            <span className="micro">Strapline</span>
            <input name="strapline" value={strapline} onChange={(e) => setStrapline(e.target.value)}
              placeholder="The UK's publication for ..." autoComplete="off" />
          </label>

          {/*
            Every agent prompt opens with this line, and the Researcher
            commissions against it. Worth more care than anything else on this
            form: "fleet managers" produces a different publication from "UK
            fleet managers and transport operators running commercial vehicle
            fleets", and the second is the one that gets useful commissions.
          */}
          <label className="field field-wide">
            <span className="micro">Readers</span>
            <input name="audience"
              placeholder="UK fleet managers and transport operators running commercial vehicle fleets"
              autoComplete="off" />
            <span style={{ fontSize: 11.5, opacity: 0.5, marginTop: 3 }}>
              Who the magazine is for, in one line. Every agent is told this, and the Researcher
              commissions against it. Be specific.
            </span>
          </label>

          <label className="field">
            <span className="micro">Domain</span>
            <input name="domain" placeholder="smartmanufacturing.co.uk" autoComplete="off" />
          </label>

          <label className="field">
            <span className="micro">Mark text (2–4 characters)</span>
            <input name="mark" value={mark} maxLength={4}
              onChange={(e) => setMark(e.target.value.toUpperCase())}
              placeholder="SM" autoComplete="off" />
          </label>

          <label className="field field-wide">
            <span className="micro">Sections, comma separated</span>
            <input name="sections" placeholder="Automation, Finance, Operations, Marketing" autoComplete="off" />
            <em className="field-note">
              News and Case Studies are added automatically and are never commissionable —
              news must be genuinely new, and a case study needs a real, publicly reported situation.
            </em>
          </label>

          <label className="field">
            <span className="micro">Byline</span>
            <select name="bylineMode" defaultValue="shared_person">
              <option value="shared_person">Shared editor across titles</option>
              <option value="per_title_person">Own named editor</option>
              <option value="masthead">Masthead, no personal name</option>
            </select>
          </label>

          <label className="field">
            <span className="micro">Author name</span>
            <input name="authorName" placeholder="James Burke" autoComplete="off" />
          </label>

          <label className="field">
            <span className="micro">Editorial intake address</span>
            <input name="authorEmail" placeholder="jb@smartmanufacturing.co.uk" autoComplete="off" />
          </label>
        </div>
      </section>

      <aside className="panel newtitle-side">
        <span className="micro">How it will look in the rail</span>
        <div className="newtitle-preview">
          <SiteMark site={preview} size={56} />
          <div>
            <strong>{preview.name}</strong>
            <span className="micro">{effectiveSlug || "slug"}</span>
          </div>
        </div>

        <span className="micro" style={{ marginTop: 6 }}>Accent</span>
        <div className="newtitle-swatches">
          {PRESETS.map(([a, b]) => (
            <button
              key={a}
              type="button"
              className={`newtitle-swatch${a === accent ? " is-active" : ""}`}
              style={{ background: `linear-gradient(150deg, ${a}, ${b})` }}
              onClick={() => { setAccent(a); setAccent2(b); }}
              aria-label={`Use accent ${a}`}
            />
          ))}
        </div>
        <input type="hidden" name="accent" value={accent} />
        <input type="hidden" name="accent2" value={accent2} />

        <p className="newtitle-note">
          The title is created with its engine switched off and marked <b>in setup</b>. Nothing
          is commissioned or published until you have worked through the integration checklist
          on its settings page and turned the engine on.
        </p>

        <button className="btn" type="submit" disabled={!name || clash}>Create title</button>
      </aside>
    </form>
  );
}
