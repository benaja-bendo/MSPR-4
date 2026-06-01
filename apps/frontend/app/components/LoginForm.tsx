"use client";

import { useState } from "react";
import {
  PASSWORD_MIN_LENGTH,
  loginSchema,
  type LoginDTO,
} from "@cofrap/shared-types";

export function LoginForm() {
  const [form, setForm] = useState<LoginDTO>({ email: "", password: "" });
  const [errors, setErrors] = useState<string[]>([]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = loginSchema.safeParse(form);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors(
        Object.values(fieldErrors)
          .flat()
          .filter((message): message is string => Boolean(message)),
      );
      return;
    }

    setErrors([]);
    // Appel OpenFaaS : POST /function/fn-auth/login
    console.log("Login valide côté frontend", result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={(event) =>
            setForm((current) => ({ ...current, email: event.target.value }))
          }
          className="w-full rounded-lg border border-zinc-300 px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Mot de passe (min. {PASSWORD_MIN_LENGTH} caractères)
        </label>
        <input
          id="password"
          type="password"
          value={form.password}
          onChange={(event) =>
            setForm((current) => ({ ...current, password: event.target.value }))
          }
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

      <button
        type="submit"
        className="rounded-lg bg-black px-4 py-2 font-medium text-white hover:bg-zinc-800"
      >
        Se connecter
      </button>
    </form>
  );
}
