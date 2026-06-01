import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 24;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`);

export const loginSchema = z.object({
  email: z.string().email("Adresse e-mail invalide"),
  password: passwordSchema,
});

export const registerSchema = z.object({
  email: z.string().email("Adresse e-mail invalide"),
  password: passwordSchema,
});

export const mfaVerifySchema = z.object({
  userId: z.string().min(1),
  code: z.string().length(6, "Le code MFA doit contenir 6 chiffres"),
});

export type LoginDTO = z.infer<typeof loginSchema>;
export type RegisterDTO = z.infer<typeof registerSchema>;
export type MfaVerifyDTO = z.infer<typeof mfaVerifySchema>;
