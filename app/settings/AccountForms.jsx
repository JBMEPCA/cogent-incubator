"use client";

import { useActionState, useState } from "react";
import { createAccount, resetPassword, setRole, deleteAccount } from "@/lib/account-actions";

// The interactive half of App settings → Accounts. Client components so each
// action can answer in place ("created", "only admin") and, when a password was
// generated, show it once with a copy button. That one render is the only place
// a generated password ever exists outside the person's own head.

function Message({ state }) {
  if (!state?.message) return null;
  return <p className={state.ok ? "field-note" : "field-err"}>{state.message}</p>;
}

/** A generated password, shown once. Gone on the next page load. */
function OneTime({ state }) {
  const [copied, setCopied] = useState(false);
  if (!state?.ok || !state.password) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="acct-onetime" role="status">
      <span className="micro">
        Password for <b>{state.username}</b>. Copy it now: it is not stored and can&apos;t be shown again.
      </span>
      <div className="acct-onetime-row">
        <code>{state.password}</code>
        <button type="button" className="btn-ghost" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function CreateAccountForm() {
  const [state, action, pending] = useActionState(createAccount, null);
  return (
    <form action={action} className="acct-create">
      <label className="field">
        <span className="micro">Name</span>
        <input name="name" required placeholder="e.g. Lucas Price" autoComplete="off" />
      </label>
      <label className="field">
        <span className="micro">Username</span>
        <input name="username" required placeholder="e.g. lucas" autoComplete="off" autoCapitalize="none" />
      </label>
      <label className="field">
        <span className="micro">Access</span>
        <select name="role" defaultValue="viewer">
          <option value="viewer">Read-only</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <label className="field">
        <span className="micro">Password</span>
        <input name="password" type="password" placeholder="Leave blank to generate" autoComplete="new-password" />
      </label>
      <div className="acct-create-go">
        <button className="btn" disabled={pending}>{pending ? "Creating…" : "Create account"}</button>
      </div>
      <div className="acct-create-out">
        <Message state={state} />
        <OneTime state={state} />
      </div>
    </form>
  );
}

/** Role, password and removal for one existing account. */
export function AccountControls({ id, role, isSelf }) {
  const [roleState, roleAction, rolePending] = useActionState(setRole, null);
  const [pwState, pwAction, pwPending] = useActionState(resetPassword, null);
  const [delState, delAction, delPending] = useActionState(deleteAccount, null);
  const [typing, setTyping] = useState(false);

  return (
    <div className="acct-controls">
      <form action={roleAction} className="acct-inline">
        <input type="hidden" name="id" value={id} />
        <select name="role" defaultValue={role} aria-label="Access">
          <option value="viewer">Read-only</option>
          <option value="admin">Admin</option>
        </select>
        <button className="btn-ghost" disabled={rolePending}>Save</button>
      </form>

      <form action={pwAction} className="acct-inline">
        <input type="hidden" name="id" value={id} />
        {typing && (
          <input
            name="password"
            type="password"
            placeholder="New password"
            autoComplete="new-password"
            aria-label="New password"
            minLength={10}
          />
        )}
        <button className="btn-ghost" disabled={pwPending}>
          {typing ? "Set password" : "Generate new password"}
        </button>
        <button type="button" className="btn-ghost acct-quiet" onClick={() => setTyping((t) => !t)}>
          {typing ? "Generate instead" : "Type one"}
        </button>
      </form>

      {!isSelf && (
        <form
          action={delAction}
          className="acct-inline"
          onSubmit={(e) => {
            if (!confirm("Remove this account? They lose access straight away.")) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={id} />
          <button className="btn-ghost acct-danger" disabled={delPending}>Remove</button>
        </form>
      )}

      <div className="acct-out">
        <Message state={roleState} />
        <Message state={pwState} />
        <OneTime state={pwState} />
        <Message state={delState} />
      </div>
    </div>
  );
}
