import SettingsHead, { AdminsOnly } from "./SettingsHead";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canEdit } from "@/lib/permissions";
import { CreateAccountForm, AccountControls } from "./AccountForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "App settings" };

// App settings: things that belong to the incubator itself rather than to any
// one title (those live under each title's own Settings gear). Accounts is the
// first section; the sub-tab row is there for the next.
//
// Admins only. A read-only account sees why it can't, not an empty page.

const day = (d) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });

export default async function AppSettingsPage() {
  const head = <SettingsHead active="/settings" />;

  if (!(await canEdit())) {
    return (
      <main className="fleet-wrap">
        {head}
        <AdminsOnly />
      </main>
    );
  }

  const [session, users] = await Promise.all([
    auth(),
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: { id: true, username: true, name: true, role: true, createdAt: true },
    }),
  ]);
  const myId = session?.user?.id;

  return (
    <main className="fleet-wrap">
      {head}

      <section className="panel acct-panel">
        <div className="acct-head">
          <div>
            <h2>Accounts</h2>
            <p className="micro">
              Everyone who can sign in. Admins can change things; read-only accounts can look but not
              edit. Passwords are stored as a one-way hash, so nobody can read an existing one, here or
              anywhere else. To give someone access again, set a new password and pass it on.
            </p>
          </div>
          <span className="acct-count">{users.length} accounts</span>
        </div>

        <ul className="acct-list">
          {users.map((u) => (
            <li key={u.id} className="acct-row">
              <div className="acct-who">
                <span className="acct-avatar" aria-hidden="true">
                  {u.name.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <b>{u.name}</b>
                  {u.id === myId && <span className="chip chip-brand acct-you">You</span>}
                  <div className="micro">
                    <code>{u.username}</code> · {u.role === "admin" ? "Admin" : "Read-only"} · since {day(u.createdAt)}
                  </div>
                </div>
              </div>
              <AccountControls id={u.id} role={u.role} isSelf={u.id === myId} />
            </li>
          ))}
        </ul>
      </section>

      <section className="panel acct-panel">
        <h2>Add an account</h2>
        <p className="micro">
          Leave the password blank and one is generated and shown to you once, ready to send to them.
        </p>
        <CreateAccountForm />
      </section>
    </main>
  );
}
