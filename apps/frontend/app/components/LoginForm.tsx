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

type Mode = "login" | "renew-password" | "renew-mfa" | "renew-done";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [passwordQr, setPasswordQr] = useState<string | null>(null);
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [renewTotp, setRenewTotp] = useState("");

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

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = loginSchema.safeParse({ username, password, totpCode });
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors(
        Object.values(fieldErrors)
          .flat()
          .filter((m): m is string => Boolean(m)),
      );
      return;
    }
    setErrors([]);
    const response = await loginUser(
      result.data.username,
      result.data.password,
      result.data.totpCode,
    );
    if (response.expired && response.action === "renew") {
      setMessage(response.error ?? "Compte expiré.");
      setMode("renew-password");
      return;
    }
    if (!response.success) {
      applyErrors(response);
      return;
    }
    setMessage(`Connecté. Session : ${response.session?.token?.slice(0, 12)}…`);
  }

  async function startRenew() {
    const parsed = usernameSchema.safeParse(username);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().formErrors);
      return;
    }
    await renewUser(parsed.data);
    const gen = await generatePassword(parsed.data, true);
    if (!gen.success || !gen.qrDataUrl) {
      applyErrors(gen);
      return;
    }
    setPasswordQr(gen.qrDataUrl);
    setMode("renew-password");
    setMessage("Nouveau mot de passe (QR). Puis reconfigurez la 2FA.");
  }

  async function continueRenewMfa() {
    const res = await setupMfa(username);
    if (!res.success || !res.qrDataUrl) {
      applyErrors(res);
      return;
    }
    setMfaQr(res.qrDataUrl);
    setMode("renew-mfa");
  }

  async function finishRenew(event: React.FormEvent) {
    event.preventDefault();
    const res = await confirmMfa(username, renewTotp);
    if (!res.success) {
      applyErrors(res);
      return;
    }
    setMode("renew-done");
    setMessage("Renouvellement terminé. Reconnectez-vous.");
  }

  if (mode === "renew-password" && passwordQr) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-amber-800">Compte expiré — nouveau mot de passe (QR unique)</p>
        <img src={passwordQr} alt="QR renouvellement" className="mx-auto h-48 w-48" />
        <button
          type="button"
          onClick={continueRenewMfa}
          className="rounded-lg bg-black px-4 py-2 text-white"
        >
          Configurer la nouvelle 2FA
        </button>
      </div>
    );
  }

  if (mode === "renew-mfa" && mfaQr) {
    return (
      <form onSubmit={finishRenew} className="flex flex-col gap-3">
        <img src={mfaQr} alt="QR 2FA" className="mx-auto h-48 w-48" />
        <input
          value={renewTotp}
          onChange={(e) => setRenewTotp(e.target.value)}
          maxLength={6}
          placeholder="Code 2FA"
          className="rounded-lg border border-zinc-300 px-3 py-2"
        />
        <button type="submit" className="rounded-lg bg-black px-4 py-2 text-white">
          Valider le renouvellement
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleLogin} className="flex w-full max-w-md flex-col gap-4">
      <h2 className="text-xl font-semibold">Connexion</h2>
      <div>
        <label htmlFor="username" className="mb-1 block text-sm font-medium">
          Identifiant
        </label>
        <input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Mot de passe (reçu via QR à l&apos;inscription)
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="totp" className="mb-1 block text-sm font-medium">
          Code 2FA (6 chiffres)
        </label>
        <input
          id="totp"
          value={totpCode}
          onChange={(e) => setTotpCode(e.target.value)}
          maxLength={6}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2"
        />
      </div>
      {errors.length > 0 && (
        <ul className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {message && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p>
      )}
      <button
        type="submit"
        className="rounded-lg bg-black px-4 py-2 font-medium text-white hover:bg-zinc-800"
      >
        Se connecter
      </button>
      <button
        type="button"
        onClick={startRenew}
        className="text-sm text-zinc-600 underline"
      >
        Renouveler mot de passe / 2FA (expiration 6 mois)
      </button>
    </form>
  );
}
