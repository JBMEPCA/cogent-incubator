import Link from "next/link";

// The pieces every home page widget is built from. No hooks and no server-only
// imports, so client widgets (the targets editor) can use them too.

/** A widget card: title, one-line description, and the link to its full page. */
export function Widget({ title, sub, href, linkLabel = "Open page", actions, span = 4, className = "", children, id }) {
  return (
    <section className={`dw dw-span-${span} ${className}`} id={id}>
      <header className="dw-head">
        <div>
          <h2>{title}</h2>
          {sub && <p className="dw-sub">{sub}</p>}
        </div>
        <div className="dw-actions">
          {actions}
          {href && (
            <Link href={href} className="dw-open">
              {linkLabel} <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}

/** Shown in place of a widget's body when its data could not be read. */
export function WidgetNote({ children }) {
  return <p className="dw-note">{children}</p>;
}

/**
 * A 252° arc gauge. `pct` is 0–1 (or over, for a cap that has been passed);
 * the arc stops at full, the label does not.
 */
export function Gauge({ pct, label, sub, color, size = 132 }) {
  const stroke = Math.max(10, Math.round(size / 13));
  const r = size / 2 - stroke;
  const c = size / 2;
  const a0 = Math.PI * 0.8;
  const sweep = Math.PI * 1.4;
  const at = (a) => [c + r * Math.cos(a), c + r * Math.sin(a)];
  const arc = (f) => {
    const f1 = Math.max(0.0001, Math.min(1, f));
    const [x0, y0] = at(a0);
    const [x1, y1] = at(a0 + sweep * f1);
    return `M${x0.toFixed(2)},${y0.toFixed(2)}A${r},${r} 0 ${sweep * f1 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
  };
  return (
    <svg viewBox={`0 0 ${size} ${size * 0.86}`} width={size} role="img" aria-label={`${label} ${sub}`}>
      <path d={arc(1)} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} strokeLinecap="round" />
      {pct > 0 && (
        <path d={arc(pct)} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" className="dw-gauge-arc" />
      )}
      <text x={c} y={c + 2} fill={color} fontSize={size / 5.4} fontWeight="600" textAnchor="middle" className="dw-gauge-v">
        {label}
      </text>
      <text x={c} y={c + size / 7} fill="var(--muted)" fontSize={size / 12.5} textAnchor="middle">
        {sub}
      </text>
    </svg>
  );
}

/** A thin progress bar. */
export function Meter({ pct, color, height = 5 }) {
  return (
    <div className="dw-meter" style={{ height }}>
      <i style={{ width: `${Math.round(Math.max(0, Math.min(1, pct || 0)) * 100)}%`, background: color }} />
    </div>
  );
}

export const fmtK = (n) => {
  if (n == null) return "–";
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(n));
};

export const gbp = (v) => `£${Math.round(v || 0).toLocaleString("en-GB")}`;
