const authBase = process.env.NEXT_PUBLIC_FN_AUTH_URL ?? "http://localhost:8080";
const passwordBase = process.env.NEXT_PUBLIC_FN_PASSWORD_URL ?? "http://localhost:8082";
const mfaBase = process.env.NEXT_PUBLIC_FN_MFA_URL ?? "http://localhost:8081";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json() as Promise<T>;
}

export type ApiResult = {
  success: boolean;
  error?: string;
  errors?: Record<string, string[] | undefined>;
  expired?: boolean;
  action?: string;
  qrDataUrl?: string;
  message?: string;
  status?: string;
  session?: { token: string; expiresAt: string };
  user?: { id: string; username: string };
};

export function registerUser(username: string) {
  return postJson<ApiResult>(`${authBase}/register`, { username });
}

export function loginUser(username: string, password: string, totpCode: string) {
  return postJson<ApiResult>(`${authBase}/login`, { username, password, totpCode });
}

export function renewUser(username: string) {
  return postJson<ApiResult>(`${authBase}/renew`, { username });
}

export function generatePassword(username: string, renew = false) {
  return postJson<ApiResult>(`${passwordBase}/generate`, { username, renew });
}

export function setupMfa(username: string) {
  return postJson<ApiResult>(`${mfaBase}/setup`, { username });
}

export function confirmMfa(username: string, code: string) {
  return postJson<ApiResult>(`${mfaBase}/confirm`, { username, code });
}
