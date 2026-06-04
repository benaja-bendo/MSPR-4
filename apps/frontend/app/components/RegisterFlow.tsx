"use client";

import { useState } from "react";
import { usernameSchema } from "@cofrap/shared-types";
import {
  confirmMfa,
  generatePassword,
  registerUser,
  setupMfa,
  type ApiResult,
} from "../../lib/api";

type Step = "register" | "password-qr" | "mfa-qr" | "done";

const STEPS = [
  { id: "register", label: "Identifiant" },
  { id: "password-qr", label: "Mot de passe" },
  { id: "mfa-qr", label: "2FA" },
  { id: "done", label: "Activé" },
] as const;

function stepIndex(s: Step) {
  return STEPS.findIndex((x) => x.id === s);
}

function applyErrors(result: ApiResult): string[] {
  if (result.errors) {
    return Object.values(result.errors).flat().filter((m): m is string => Boolean(m));
  }
  return result.error ? [result.error] : ["Erreur inconnue"];
}

export function RegisterFlow() {
  const [username, setUsername] = useState("");
  const [step, setStep] = useState<Step>("register");
  const [passwordQr, setPasswordQr] = useState<string | null>(null);
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const current = stepIndex(step);

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    const parsed = usernameSchema.safeParse(username);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().formErrors);
      return;
    }
    setErrors([]);
    setLoading(true);
    try {
      const result = await registerUser(parsed.data);
      if (!result.success) { setErrors(applyErrors(result)); return; }
      const gen = await generatePassword(parsed.data, false);
      if (!gen.success || !gen.qrDataUrl) { setErrors(applyErrors(gen)); return; }
      setPasswordQr(gen.qrDataUrl);
      setStep("password-qr");
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaSetup() {
    setErrors([]);
    setLoading(true);
    try {
      const result = await setupMfa(username);
      if (!result.success || !result.qrDataUrl) { setErrors(applyErrors(result)); return; }
      setMfaQr(result.qrDataUrl);
      setStep("mfa-qr");
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaConfirm(event: React.FormEvent) {
    event.preventDefault();
    setErrors([]);
    setLoading(true);
    try {
      const result = await confirmMfa(username, totpCode);
      if (!result.success) { setErrors(applyErrors(result)); return; }
      setStep("done");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div key={s.id} className="flex items-center" style={{ flex: i < STEPS.length - 1 ? "1" : "0" }}>
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div
                  className={[
                    "h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300",
                    done
                      ? "bg-[#10b981] text-white"
                      : active
                        ? "bg-[#0f172a] text-white ring-4 ring-[#0f172a]/10"
                        : "bg-[#f1f5f9] text-[#94a3b8]",
                  ].join(" ")}
                >
                  {done ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span className={[
                  "text-[10px] font-medium whitespace-nowrap",
                  active ? "text-[#0f172a]" : done ? "text-[#10b981]" : "text-[#94a3b8]",
                ].join(" ")}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={[
                  "h-0.5 flex-1 mx-2 rounded-full transition-all duration-500 mb-4",
                  done ? "bg-[#10b981]" : "bg-[#e2e8f0]",
                ].join(" ")} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step: register */}
      {step === "register" && (
        <form onSubmit={handleRegister} className="flex flex-col gap-4 animate-fade-in">
          <div>
            <label htmlFor="reg-username" className="block text-sm font-medium text-[#374151] mb-1.5">
              Identifiant
            </label>
            <input
              id="reg-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex : jean.dupont"
              autoComplete="username"
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#e2e8f0] bg-white text-[#0f172a] text-sm placeholder:text-[#94a3b8] outline-none transition-all focus:border-[#0ea5e9] focus:ring-3 focus:ring-[#0ea5e9]/15"
            />
            <p className="mt-1.5 text-[11px] text-[#94a3b8]">
              Lettres, chiffres, . _ - uniquement &middot; 3 à 64 caractères
            </p>
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
            disabled={loading || !username.trim()}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all active:scale-[0.98]"
          >
            {loading ? (
              <><span className="spinner" />Création en cours…</>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                Créer le compte
              </>
            )}
          </button>
        </form>
      )}

      {/* Step: password QR */}
      {step === "password-qr" && passwordQr && (
        <div className="flex flex-col gap-4 animate-fade-in">
          <div className="p-3.5 rounded-lg bg-[#fffbeb] border border-[#fde68a]">
            <div className="flex items-start gap-2.5">
              <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 14 14" fill="#d97706">
                <path fillRule="evenodd" d="M7 1a6 6 0 100 12A6 6 0 007 1zm-.75 3.5a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0v-3zm.75 5.5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd"/>
              </svg>
              <p className="text-xs text-[#92400e] leading-relaxed">
                <strong>QR à usage unique.</strong> Scannez ce code maintenant avec votre téléphone pour récupérer votre mot de passe. Il ne sera plus affiché.
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-[0_4px_12px_rgb(0,0,0,0.08)] p-4 inline-block">
              <img
                src={passwordQr}
                alt="QR code du mot de passe"
                className="h-44 w-44 block"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]">
            <div className="h-5 w-5 rounded-full bg-[#0f172a] flex items-center justify-center flex-shrink-0">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5l2.5 2.5L8 2.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-xs text-[#475569]">Mot de passe de 24 caractères généré pour <strong className="text-[#0f172a]">{username}</strong></p>
          </div>

          {errors.length > 0 && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#fef2f2] border border-[#fecaca] animate-fade-in">
              <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 14 14" fill="#ef4444">
                <path fillRule="evenodd" d="M7 1a6 6 0 100 12A6 6 0 007 1zm-.75 3.5a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0v-3zm.75 5.5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd"/>
              </svg>
              <div className="text-xs text-[#b91c1c]">
                {errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleMfaSetup}
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#0ea5e9] hover:bg-[#0284c7] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all active:scale-[0.98]"
          >
            {loading ? (
              <><span className="spinner" />Préparation 2FA…</>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="2" y="5.5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M4.5 5.5V4a2.5 2.5 0 015 0v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  <circle cx="7" cy="9" r="1" fill="currentColor"/>
                </svg>
                Configurer l&apos;authentification 2FA
              </>
            )}
          </button>
        </div>
      )}

      {/* Step: MFA QR */}
      {step === "mfa-qr" && mfaQr && (
        <form onSubmit={handleMfaConfirm} className="flex flex-col gap-4 animate-fade-in">
          <div className="p-3.5 rounded-lg bg-[#eff6ff] border border-[#bfdbfe]">
            <div className="flex items-start gap-2.5">
              <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 14 14" fill="#2563eb">
                <path fillRule="evenodd" d="M7 1a6 6 0 100 12A6 6 0 007 1zm-.75 3.5a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0v-3zm.75 5.5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd"/>
              </svg>
              <p className="text-xs text-[#1e40af] leading-relaxed">
                Scannez ce QR avec <strong>Google Authenticator</strong> ou une autre app 2FA, puis entrez le code généré.
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-[0_4px_12px_rgb(0,0,0,0.08)] p-4 inline-block">
              <img src={mfaQr} alt="QR code 2FA" className="h-44 w-44 block" />
            </div>
          </div>

          <div>
            <label htmlFor="totp-reg" className="block text-sm font-medium text-[#374151] mb-1.5">
              Code de vérification
            </label>
            <input
              id="totp-reg"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="• • • • • •"
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="w-full px-4 py-3 rounded-lg border border-[#e2e8f0] bg-white text-[#0f172a] text-xl font-mono tracking-[0.4em] text-center placeholder:text-[#cbd5e1] placeholder:tracking-[0.2em] placeholder:text-sm outline-none transition-all focus:border-[#0ea5e9] focus:ring-3 focus:ring-[#0ea5e9]/15"
            />
          </div>

          {errors.length > 0 && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#fef2f2] border border-[#fecaca] animate-fade-in">
              <svg className="flex-shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 14 14" fill="#ef4444">
                <path fillRule="evenodd" d="M7 1a6 6 0 100 12A6 6 0 007 1zm-.75 3.5a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0v-3zm.75 5.5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd"/>
              </svg>
              <div className="text-xs text-[#b91c1c]">
                {errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || totpCode.length !== 6}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[#0f172a] hover:bg-[#1e293b] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all active:scale-[0.98]"
          >
            {loading ? (
              <><span className="spinner" />Vérification…</>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Activer le compte
              </>
            )}
          </button>
        </form>
      )}

      {/* Step: done */}
      {step === "done" && (
        <div className="flex flex-col items-center gap-4 py-4 animate-fade-in">
          <div className="h-14 w-14 rounded-full bg-[#ecfdf5] border-2 border-[#a7f3d0] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l5 5L19 7" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-[#0f172a]">Compte activé !</p>
            <p className="text-sm text-[#64748b] mt-1">
              <strong className="text-[#0f172a]">{username}</strong> est prêt. Connectez-vous dans le panneau de droite.
            </p>
          </div>
          <div className="w-full p-3.5 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0]">
            <div className="flex items-center gap-2.5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="#065f46">
                <path fillRule="evenodd" d="M7 1a6 6 0 100 12A6 6 0 007 1zm-.75 3.5a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0v-3zm.75 5.5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd"/>
              </svg>
              <p className="text-xs text-[#065f46] leading-relaxed">
                Vos identifiants expirent dans <strong>6 mois</strong>. Un renouvellement sera requis à cette date.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
