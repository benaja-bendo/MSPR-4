import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 24;
export const CREDENTIAL_MAX_AGE_MS = 6 * 30 * 24 * 60 * 60 * 1000;

export const USER_STATUSES = [
  "pending_password",
  "pending_mfa",
  "active",
  "expired",
] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export const usernameSchema = z
  .string()
  .min(3, "Identifiant trop court")
  .max(64, "Identifiant trop long")
  .regex(/^[a-zA-Z0-9._-]+$/, "Caractères autorisés : lettres, chiffres, . _ -");

export const registerSchema = z.object({
  username: usernameSchema,
});

export const generatePasswordSchema = z.object({
  username: usernameSchema,
  renew: z.boolean().optional(),
});

export const renewSchema = z.object({
  username: usernameSchema,
});

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, "Mot de passe requis"),
  totpCode: z.string().length(6, "Le code 2FA doit contenir 6 chiffres"),
});

export const mfaSetupSchema = z.object({
  username: usernameSchema,
});

export const mfaConfirmSchema = z.object({
  username: usernameSchema,
  code: z.string().length(6, "Le code MFA doit contenir 6 chiffres"),
});

export function isCredentialExpired(gendate: Date, now = new Date()): boolean {
  return now.getTime() - gendate.getTime() > CREDENTIAL_MAX_AGE_MS;
}

export type RegisterDTO = z.infer<typeof registerSchema>;
export type LoginDTO = z.infer<typeof loginSchema>;
export type MfaConfirmDTO = z.infer<typeof mfaConfirmSchema>;
