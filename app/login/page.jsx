import { authenticate } from "@/lib/actions";
import Logo from "../components/Logo";

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const hasError = params?.error;

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
        <div style={{ fontSize: 30 }}>
          <Logo />
        </div>
        <div className="micro">Launch HQ — Director access</div>
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
        {hasError && (
          <p style={{ color: "var(--neon-red)", fontSize: 13, marginTop: 0 }}>
            Wrong username or password.
          </p>
        )}
        <button type="submit" className="btn" style={{ width: "100%" }}>
          Sign in
        </button>
      </form>
    </div>
  );
}
