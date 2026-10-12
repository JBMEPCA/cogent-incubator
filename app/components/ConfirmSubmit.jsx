"use client";

// A one-button form that asks before it runs. For deletes on the advertiser
// list, where a stray click would lose contacts nobody wrote down elsewhere.
export default function ConfirmSubmit({ action, question, label = "Remove", className = "btn-ghost", style }) {
  return (
    <form
      action={action}
      style={{ display: "inline" }}
      onSubmit={(e) => {
        if (!window.confirm(question)) e.preventDefault();
      }}
    >
      <button type="submit" className={className} style={style}>
        {label}
      </button>
    </form>
  );
}
