"use client";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
} from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import BrandWordmark from "./brand-wordmark";
import { LanguageControl } from "./i18n";

export function PasswordInput({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="password-label">
      {label}
      <span className="password-input-wrap">
        <input {...props} type={visible ? "text" : "password"} />
        <button
          type="button"
          className="password-visibility"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      </span>
    </label>
  );
}
async function request(url: string, body?: unknown) {
  const response = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed");
  return result;
}
export default function Login({
  onLogin,
  companyCode,
}: {
  onLogin: () => Promise<void>;
  companyCode?: string;
}) {
  const [id, setId] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState(false),
    [checking, setChecking] = useState(true),
    [newPassword, setNewPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    let active = true;
    request("/api/profile/password/setup")
      .then((data) => {
        if (active) setSetup(data.required === true);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await request("/api/login", {
        employeeId: id,
        password,
        companyCode: companyCode || null,
      });
      setPassword("");
      if (result.passwordSetupRequired) {
        setSetup(true);
        return;
      }
      await onLogin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const finish = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmation) {
      setError("New passwords do not match.");
      return;
    }
    if (
      newPassword.length < 12 ||
      new TextEncoder().encode(newPassword).length > 72
    ) {
      setError("Use at least 12 characters (maximum 72 bytes).");
      return;
    }
    if (newPassword === id) {
      setError("Your new password must be different from your Employee ID.");
      return;
    }
    setBusy(true);
    try {
      await request("/api/profile/password/setup", {
        newPassword,
        confirmPassword: confirmation,
      });
      setNewPassword("");
      setConfirmation("");
      setSetup(false);
      await onLogin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className={`login-page${setup ? "" : " login-welcome-page"}`}>
        {!setup && (
          <div className="login-language">
            <LanguageControl />
          </div>
        )}
        <div className="login-brand">
          <span className="login-logo">
            <img src="/eso-shield.png" alt="ESO safety shield" />
          </span>
          <BrandWordmark compact />
        </div>
        {checking ? (
          <div role="status" className="login-checking">
            <LoaderCircle className="login-spinner" /> Loading…
          </div>
        ) : setup ? (
          <form
            ref={form}
            className="login-card password-setup-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-setup-title"
            aria-describedby="password-setup-description"
            onSubmit={finish}
            onKeyDown={(event) => {
              if (event.key === "Escape") event.preventDefault();
              if (event.key === "Tab") {
                const controls = Array.from(
                  form.current?.querySelectorAll<HTMLElement>(
                    "input:not(:disabled),button:not(:disabled)",
                  ) || [],
                );
                const first = controls[0],
                  last = controls.at(-1);
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <div className="login-icon">
              <KeyRound size={28} />
            </div>
            <h1 id="password-setup-title">Set your password</h1>
            <p id="password-setup-description">
              Create your personal password to continue. This step is required
              and replaces your initial Employee ID password.
            </p>
            <PasswordInput
              label="New Password"
              autoFocus
              required
              minLength={12}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => {setNewPassword(e.target.value);setError("")}}
              disabled={busy}
            />
            <PasswordInput
              label="Confirm New Password"
              required
              minLength={12}
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => {setConfirmation(e.target.value);setError("")}}
              disabled={busy}
            />
            <small className="password-guidance">
              Use at least 12 characters. A phrase with several words works
              well.
            </small>
            {error && (
              <div role="alert" className="form-error">
                {error}
              </div>
            )}
            <button type="submit" className="primary-btn" disabled={busy}>
              <ShieldCheck size={18} />
              {busy ? "SAVING…" : "SAVE PASSWORD & CONTINUE"}
            </button>
          </form>
        ) : (
          <form className="login-card" onSubmit={submit}>
            <div className="login-icon">
              <ShieldCheck size={30} />
            </div>
            <h1>Welcome</h1>
            <p>
              {companyCode && (
                <>
                  Company: <b>{companyCode}</b> •{" "}
                </>
              )}
              Enter your Employee ID and password.
            </p>
            <label>
              Employee ID
              <input
                autoFocus
                required
                autoComplete="username"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="e.g. 10001"
              />
            </label>
            <PasswordInput
              label="Password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <small className="password-guidance">
              Use your Employee ID as the initial password for the first log in.
            </small>
            {error && (
              <div role="alert" className="form-error">
                {error}
              </div>
            )}
            <button className="primary-btn" disabled={busy}>
              <LogIn size={17} />
              {busy ? "SIGNING IN…" : "LOG IN"}
            </button>
            <a className="owner-back-link" href="/owner">
              Platform Owner Console
            </a>
          </form>
        )}
      </div>
    </>
  );
}

