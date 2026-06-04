"use client";

import { useState } from "react";
import { loginSchema, usernameSchema } from "@cofrap/shared-types";
import {
  generatePassword,
  loginUser,
  renewUser,
  setupMfa,
  confirmMfa,
  type ApiResult,
} from "../../lib/api";

type Mode = "login" | "renew-password" | "renew-mfa" | "renew-done" | "logged-in";

function applyErrors(result: ApiResult): string[] {
  if (result.errors) {
    return Object.values(result.errors).flat().filter((m): m is string => Boolean(m));
  }
  return result.error ? [result.error] : ["Erreur inconnue"];
}

function InputField({
  id, label, type = "text", value, onChange, placeholder, hint, autoComplete, inputMode, maxLength, disabled,
}: {
  id: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; hint?: string;
  autoComplete?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number; disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[#374151] mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword ? (show ? "text" : "password") : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          disabled={disabled}
          className="w-full px-3.5 py-2.5 rounded-lg border border-[#e2e8f0] bg-white text-[#0f172a] text-sm placeholder:text-[#94a3b8] outline-none transition-all focus:border-[#0ea5e9] focus:ring-3 focus:ring-[#0ea5e9]/15 disabled:opacity-50 disabled:bg-[#f8fafc]"
          style={isPassword ? { paddingRight: "2.75rem" } : undefined}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b] transition-colors"
            tabIndex={-1}
            aria-label={show ? "Masquer" : "Afficher"}
          >
            {show ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 2l12 12M6.41 6.44A2 2 0 0010 9.59M4.07 4.1C2.76 5 1.7 6.36 1 8c1.44 3.13 4.5 5 7 5 1.2 0 2.37-.37 3.38-1M7.5 3.05C7.67 3.02 7.83 3 8 3c2.5 0 5.56 1.87 7 5-1.44 3.13-4.5 5-7 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M1 8C2.44 4.87 5.5 3 8 3s5.56 1.87 7 5c-1.44 3.13-4.5 5-7 5s-5.56-1.87-7-5z" stroke="currentColor" strokeWidth="1.4"/>
                <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/>
              </svg>
            )}
          </button>
        )}
      </div>
      {hint && <p className="mt-1.5 text-[11px] text-[#94a3b8]">{hint}</p>}
    </div>
  );
}

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("login");
  const [passwordQr, setPasswordQr] = useState<string | null>(null);
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [renewTotp, setRenewTotp] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{ username: string; token: string } | null>(null);

  function resetToLogin() {
    setMode("login");
    setErrors([]);
    setPassword("");
    setTotpCode("");
    setPasswordQr(null);
    setMfaQr(null);
    setRenewTotp("");
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = loginSchema.safeParse({ username, password, totpCode });
    if (!result.success) {
      setErrors(
        Object.values(result.error.flatten().fieldErrors).flat().filter((m): m is string => Boolean(m))
      );
      return;
    }
    setErrors([]);
    setLoading(true);
    try {
      const response = await loginUser(result.data.username, result.data.password, result.data.totpCode);
      if (response.expired && response.action === "renew") {
        setErrors([response.error ?? "Compte expiré."]);
        return;
      }
      if (!response.success) {
        setErrors(applyErrors(response));
        return;
      }
      setSessionInfo({
        username: result.data.username,
        token: response.session?.token ?? "",
      });
      setMode("logged-in");
    } finally {
      setLoading(false);
    }
  }

  async function startRenew() {
    const parsed = usernameSchema.safeParse(username);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().formErrors);
      return;
    }
    setErrors([]);
    setLoading(true);
    try {
      await renewUser(parsed.data);
      const gen = await generatePassword(parsed.data, true);
      if (!gen.success || !gen.qrDataUrl) { setErrors(applyErrors(gen)); return; }
      setPasswordQr(gen.qrDataUrl);
      setMode("renew-password");
    } finally {
      setLoading(false);
    }
  }

  async function continueRenewMfa() {
    setErrors([]);
    setLoading(true);
    try {
      const res = await setupMfa(username);
      if (!res.success || !res.qrDataUrl) { setErrors(applyErrors(res)); return; }
      setMfaQr(res.qrDataUrl);
      setMode("renew-mfa");
    } finally {
      setLoading(false);
    }
  }

  async function finishRenew(event: React.FormEvent) {
    event.preventDefault();
    setErrors([]);
    setLoading(true);
    try {
      const res = await confirmMfa(username, renewTotp);
      if (!res.success) { setErrors(applyErrors(res)); return; }
      setMode("renew-done");
    } finally {
      setLoading(false);
    }
  }

  /* ── Logged in ── */
  if (mode === "logged-in" && sessionInfo) {
    return (
      <div className="flex flex-col gap-5 animate-fade-in">
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="h-14 w-14 rounded-full bg-[#ecfdf5] border-2 border-[#a7f3d0] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l5 5L19 7" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-[#0f172a]">Connexion réussie</p>
            <p className="text-sm text-[#64748b] mt-1">Bienvenue, <strong className="text-[#0f172a]">{sessionInfo.username}</strong></p>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
          <p className="text-[10px] font-medium text-[#94a3b8] uppercase tracking-wider mb-1">Token de session</p>
          <p className="text-xs font-mono text-[#475569] break-all leading-relaxed">
            {sessionInfo.token.slice(0, 24)}…
          </p>
        </div>

        <button
          type="button"
          onClick={() => { setMode("login"); setSessionInfo(null); setUsername(""); setPassword(""); setTotpCode(""); }}
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#475569] hover:text-[#0f172a] text-sm font-medium rounded-lg transition-all"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M9 6.5H1M4 3.5L1 6.5 4 9.5M7.5 3V2a1 1 0 011-1h3a1 1 0 011 1v9a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Se déconnecter
        </button>
      </div>
    );
  }

  /* ── Renew password QR ── */
  if (mode === "renew-password" && passwordQr) {
    return (
      <div className="flex flex-col gap-4 animate-fade-in">
        <div className="p-3.5 rounded-lg bg-[#fffbeb] border border-[#fde68a]">
          <div className="flex items-start gap-2.5">
            <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 14 14" fill="#d97706">
              <path fillRule="evenodd" d="M7 1a6 6 0 100 12A6 6 0 007 1zm-.75 3.5a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0v-3zm.75 5.5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd"/>
            </svg>
            <p className="text-xs text-[#92400e] leading-relaxed">
              <strong>Renouvellement.</strong> Scannez ce nouveau QR mot de passe (usage unique) avant de continuer.
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-[0_4px_12px_rgb(0,0,0,0.08)] p-4 inline-block">
            <img src={passwordQr} alt="QR renouvellement mot de passe" className="h-44 w-44 block" />
          </div>
        </div>

        {errors.length > 0 && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#fef2f2] border border-[#fecaca]">
            <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 14 14" fill="#ef4444">
              <path fillRule="evenodd" d="M7 1a6 6 0 100 12A6 6 0 007 1zm-.75 3.5a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0v-3zm.75 5.5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd"/>
            </svg>
            <div className="text-xs text-[#b91c1c]">{errors.map((e, i) => <p key={i}>{e}</p>)}</div>
          </div>
        )}

        <button
          type="button"
          onClick={continueRenewMfa}
          disabled={loading}
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#0ea5e9] hover:bg-[#0284c7] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all active:scale-[0.98]"
        >
          {loading ? (
            <><span className="spinner" />Préparation 2FA…</>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="5.5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M4.5 5.5V4a2.5 2.5 0 015 0v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Configurer la nouvelle 2FA
            </>
          )}
        </button>
      </div>
    );
  }

  /* ── Renew MFA ── */
  if (mode === "renew-mfa" && mfaQr) {
    return (
      <form onSubmit={finishRenew} className="flex flex-col gap-4 animate-fade-in">
        <div className="p-3.5 rounded-lg bg-[#eff6ff] border border-[#bfdbfe]">
          <p className="text-xs text-[#1e40af] leading-relaxed">
            Scannez ce QR avec votre application 2FA, puis entrez le code pour finaliser le renouvellement.
          </p>
        </div>

        <div className="flex justify-center">
          <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-[0_4px_12px_rgb(0,0,0,0.08)] p-4 inline-block">
            <img src={mfaQr} alt="QR 2FA renouvellement" className="h-44 w-44 block" />
          </div>
        </div>

        <div>
          <label htmlFor="renew-totp" className="block text-sm font-medium text-[#374151] mb-1.5">
            Code de vérification
          </label>
          <input
            id="renew-totp"
            value={renewTotp}
            onChange={(e) => setRenewTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="• • • • • •"
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="w-full px-4 py-3 rounded-lg border border-[#e2e8f0] bg-white text-[#0f172a] text-xl font-mono tracking-[0.4em] text-center placeholder:text-[#cbd5e1] placeholder:tracking-[0.2em] placeholder:text-sm outline-none transition-all focus:border-[#0ea5e9] focus:ring-3 focus:ring-[#0ea5e9]/15"
          />
        </div>

        {errors.length > 0 && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#fef2f2] border border-[#fecaca]">
            <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 14 14" fill="#ef4444">
              <path fillRule="evenodd" d="M7 1a6 6 0 100 12A6 6 0 007 1zm-.75 3.5a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0v-3zm.75 5.5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd"/>
            </svg>
            <div className="text-xs text-[#b91c1c]">{errors.map((e, i) => <p key={i}>{e}</p>)}</div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={resetToLogin}
            className="flex items-center justify-center py-2.5 px-3 border border-[#e2e8f0] hover:bg-[#f1f5f9] text-[#64748b] text-sm rounded-lg transition-all"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M8 2L4 6.5 8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            type="submit"
            disabled={loading || renewTotp.length !== 6}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all active:scale-[0.98]"
          >
            {loading ? (
              <><span className="spinner" />Finalisation…</>
            ) : (
              "Valider le renouvellement"
            )}
          </button>
        </div>
      </form>
    );
  }

  /* ── Renew done ── */
  if (mode === "renew-done") {
    return (
      <div className="flex flex-col items-center gap-4 py-2 animate-fade-in">
        <div className="h-14 w-14 rounded-full bg-[#ecfdf5] border-2 border-[#a7f3d0] flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 12l5 5L19 7" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="text-center">
          <p className="text-base font-semibold text-[#0f172a]">Renouvellement réussi</p>
          <p className="text-sm text-[#64748b] mt-1">
            Vos identifiants ont été renouvelés pour 6 mois.
          </p>
        </div>
        <button
          type="button"
          onClick={resetToLogin}
          className="flex items-center gap-2 py-2.5 px-5 bg-[#0f172a] hover:bg-[#1e293b] text-white text-sm font-medium rounded-lg transition-all"
        >
          Se connecter
        </button>
      </div>
    );
  }

  /* ── Login form ── */
  return (
    <form onSubmit={handleLogin} className="flex flex-col gap-4 animate-fade-in">
      <InputField
        id="login-username"
        label="Identifiant"
        value={username}
        onChange={setUsername}
        placeholder="ex : jean.dupont"
        autoComplete="username"
      />

      <InputField
        id="login-password"
        label="Mot de passe"
        type="password"
        value={password}
        onChange={setPassword}
        placeholder="Mot de passe reçu par QR"
        autoComplete="current-password"
        hint="Transmis lors de la création du compte via QR code"
      />

      <div>
        <label htmlFor="login-totp" className="block text-sm font-medium text-[#374151] mb-1.5">
          Code 2FA
        </label>
        <input
          id="login-totp"
          value={totpCode}
          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="• • • • • •"
          maxLength={6}
          inputMode="numeric"
          autoComplete="one-time-code"
          className="w-full px-4 py-2.5 rounded-lg border border-[#e2e8f0] bg-white text-[#0f172a] text-lg font-mono tracking-[0.35em] text-center placeholder:text-[#cbd5e1] placeholder:tracking-[0.2em] placeholder:text-sm outline-none transition-all focus:border-[#0ea5e9] focus:ring-3 focus:ring-[#0ea5e9]/15"
        />
        <p className="mt-1.5 text-[11px] text-[#94a3b8]">Code à 6 chiffres depuis votre application 2FA</p>
      </div>

      {errors.length > 0 && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#fef2f2] border border-[#fecaca] animate-fade-in">
          <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 14 14" fill="#ef4444">
            <path fillRule="evenodd" d="M7 1a6 6 0 100 12A6 6 0 007 1zm-.75 3.5a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0v-3zm.75 5.5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd"/>
          </svg>
          <div className="text-xs text-[#b91c1c] leading-relaxed">
            {errors.map((e, i) => <p key={i}>{e}</p>)}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !username.trim() || !password.trim() || totpCode.length !== 6}
        className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#0ea5e9] hover:bg-[#0284c7] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all active:scale-[0.98] shadow-[0_2px_8px_rgb(14,165,233,0.25)]"
      >
        {loading ? (
          <><span className="spinner" />Connexion…</>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="5.5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M4.5 5.5V4a2.5 2.5 0 015 0v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="7" cy="9" r="1" fill="currentColor"/>
            </svg>
            Se connecter
          </>
        )}
      </button>

      <div className="flex items-center gap-3 my-0.5">
        <div className="flex-1 h-px bg-[#f1f5f9]"></div>
        <span className="text-[11px] text-[#94a3b8] font-medium">ou</span>
        <div className="flex-1 h-px bg-[#f1f5f9]"></div>
      </div>

      <button
        type="button"
        onClick={startRenew}
        disabled={loading}
        className="flex items-center justify-center gap-2 w-full py-2 px-4 border border-[#e2e8f0] hover:bg-[#f8fafc] hover:border-[#cbd5e1] text-[#475569] hover:text-[#0f172a] text-sm font-medium rounded-lg transition-all disabled:opacity-50"
      >
        {loading ? (
          <><span className="spinner" />Chargement…</>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M11.5 2v3h-3M1.5 11V8h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2.1 5a5 5 0 018.45-1.58L11.5 5M1.5 8l.95 1.58A5 5 0 0010.9 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Renouveler mes identifiants
          </>
        )}
      </button>
      <p className="text-[11px] text-[#94a3b8] text-center -mt-1">
        Rotation automatique tous les 6 mois
      </p>
    </form>
  );
}
