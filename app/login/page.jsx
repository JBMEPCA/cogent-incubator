import { authenticate } from "@/lib/actions";

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const error = params?.error;

  return (
    <div style={{ maxWidth: 400, margin: "110px auto", padding: "0 20px" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: 30,
          gap: 10,
        }}
      >
        {/* The Cogent mark, not a title's. This screen sits above the whole
            portfolio, so branding it as any one publication would be wrong —
            and would leak which titles exist to anyone who reaches the page. */}
        <span className="login-mark">C</span>
        <div className="login-wordmark">
          Cogent <em>Incubator</em>
        </div>
        <div className="micro">Portfolio control room</div>
      </div>
      <form action={authenticate} className="panel panel-glow">
        <div style={{ marginBottom: 14 }}>
          <label className="micro">
            Username
            <input name="username" required autoFocus style={{ width: "100%", marginTop: 6 }} />
          </label>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="micro">
            Password
            <input name="password" type="password" required style={{ width: "100%", marginTop: 6 }} />
          </label>
        </div>
        {error === "server" ? (
          <p style={{ color: "var(--neon-amber)", fontSize: 13, margin: "0 0 12px", lineHeight: 1.55 }}>
            Can&apos;t reach the database, so sign-in is unavailable. This isn&apos;t your
            credentials — check <code>DATABASE_URL</code> and that the database is running.
          </p>
        ) : error ? (
          <p style={{ color: "var(--neon-red)", fontSize: 13, margin: "0 0 12px" }}>
            Wrong username or password.
          </p>
        ) : null}
        <button type="submit" className="btn" style={{ width: "100%" }}>
          Sign in
        </button>
      </form>
    </div>
  );
}
