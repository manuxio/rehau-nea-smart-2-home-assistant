import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { btnStyle, Field } from "../../components/ui";
import { useAuth } from "../../lib/auth";

export function Login() {
  const { login } = useAuth();
  const { t } = useTranslation();
  const [user, setUser] = useState("admin");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await login(user, pwd);
    } catch (e) {
      setErr((e as { error?: string; message?: string }).message ?? t("auth.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "80px 24px 40px",
        background:
          "radial-gradient(ellipse 130% 80% at 30% -10%, color-mix(in oklab, var(--accent) 22%, transparent) 0%, transparent 55%), var(--bg)",
        maxWidth: 420,
        margin: "0 auto",
      }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 28,
            boxShadow: "0 0 80px color-mix(in oklab, var(--accent) 30%, transparent)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--display)",
              fontSize: "1.875rem",
              fontWeight: 700,
              color: "var(--accent)",
              letterSpacing: -1,
            }}
          >
            B
          </div>
        </div>
        <div
          style={{
            fontFamily: "var(--display)",
            fontWeight: 600,
            fontSize: "2.25rem",
            color: "var(--text)",
            letterSpacing: -1.2,
            lineHeight: 1,
          }}
        >
          Betterehau
        </div>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: "0.6875rem",
            color: "var(--muted)",
            marginTop: 6,
            letterSpacing: 1.4,
            textTransform: "uppercase",
          }}
        >
          {t("app.subtitle")}
        </div>

        <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label={t("auth.user")} value={user} onChange={setUser} autoComplete="username" />
          <Field label={t("auth.password")} value={pwd} onChange={setPwd} type="password" autoComplete="current-password" />

          {err && (
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "0.75rem",
                color: "var(--alert)",
                letterSpacing: 0.3,
              }}
            >
              {err}
            </div>
          )}
        </div>
      </div>

      <button type="submit" disabled={busy} style={btnStyle("primary", "lg")}>
        {busy ? t("auth.submitBusy") : t("auth.submit")}
      </button>
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: "0.625rem",
          color: "var(--dim)",
          textAlign: "center",
          marginTop: 14,
          letterSpacing: 0.8,
        }}
      >
        {t("app.authFooter")}
      </div>
    </form>
  );
}
