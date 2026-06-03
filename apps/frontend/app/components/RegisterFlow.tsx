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

type Step = "register" | "password-qr" | "mfa-qr" | "mfa-confirm" | "done";

export function RegisterFlow() {
  const [username, setUsername] = useState("");
  const [step, setStep] = useState<Step>("register");
  const [passwordQr, setPasswordQr] = useState<string | null>(null);
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  function applyErrors(result: ApiResult) {
    if (result.errors) {
      setErrors(
        Object.values(result.errors)
          .flat()
          .filter((m): m is string => Boolean(m)),
      );
      return;
    }
    setErrors(result.error ? [result.error] : ["Erreur inconnue"]);
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    const parsed = usernameSchema.safeParse(username);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().formErrors);
      return;
    }
    setErrors([]);
    const result = await registerUser(parsed.data);
    if (!result.success) {
      applyErrors(result);
      return;
    }
    const gen = await generatePassword(parsed.data, false);
    if (!gen.success || !gen.qrDataUrl) {
      applyErrors(gen);
      return;
    }
    setPasswordQr(gen.qrDataUrl);
    setMessage(gen.message ?? null);
    setStep("password-qr");
  }

  async function handleMfaSetup() {
    const result = await setupMfa(username);
    if (!result.success || !result.qrDataUrl) {
      applyErrors(result);
      return;
    }
    setMfaQr(result.qrDataUrl);
    setMessage(result.message ?? null);
    setStep("mfa-qr");
  }

  async function handleMfaConfirm(event: React.FormEvent) {
    event.preventDefault();
    const result = await confirmMfa(username, totpCode);
    if (!result.success) {
      applyErrors(result);
      return;
    }
    setMessage(result.message ?? "Compte activé.");
    setStep("done");
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Créer un compte COFRAP</h2>

      {step === "register" && (
        <form onSubmit={handleRegister} className="flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="reg-username">
            Identifiant (username)
          </label>
          <input
            id="reg-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2"
          />
          <button type="submit" className="rounded-lg bg-black px-4 py-2 text-white">
            Créer et générer le mot de passe (QR)
          </button>
        </form>
      )}

      {step === "password-qr" && passwordQr && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-600">
            QR mot de passe (usage unique). Scannez-le pour récupérer votre mot de passe.
          </p>
          <img src={passwordQr} alt="QR mot de passe" className="mx-auto h-48 w-48" />
          <button
            type="button"
            onClick={handleMfaSetup}
            className="rounded-lg bg-black px-4 py-2 text-white"
          >
            Continuer — configurer la 2FA
          </button>
        </div>
      )}

      {(step === "mfa-qr" || step === "mfa-confirm") && mfaQr && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-600">
            QR 2FA (Google Authenticator, etc.). Puis saisissez un code à 6 chiffres.
          </p>
          <img src={mfaQr} alt="QR 2FA" className="mx-auto h-48 w-48" />
          <form onSubmit={handleMfaConfirm} className="flex flex-col gap-2">
            <input
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder="Code 2FA"
              maxLength={6}
              className="rounded-lg border border-zinc-300 px-3 py-2"
            />
            <button type="submit" className="rounded-lg bg-black px-4 py-2 text-white">
              Activer le compte
            </button>
          </form>
        </div>
      )}

      {step === "done" && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          {message ?? "Compte prêt. Vous pouvez vous connecter."}
        </p>
      )}

      {errors.length > 0 && (
        <ul className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {message && step !== "done" && (
        <p className="text-sm text-zinc-500">{message}</p>
      )}
    </div>
  );
}
