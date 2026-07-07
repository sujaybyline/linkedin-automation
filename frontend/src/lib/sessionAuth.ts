const TOKEN_KEY = "apex_token";
const LOGIN_AT_KEY = "apex_login_at";
const LAST_ACTIVITY_KEY = "apex_last_activity";

export function getIdleMinutes(): number {
  const n = Number(import.meta.env.VITE_SESSION_IDLE_MINUTES);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export function getMaxSessionHours(): number {
  const n = Number(import.meta.env.VITE_SESSION_MAX_HOURS);
  return Number.isFinite(n) && n > 0 ? n : 8;
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  const now = Date.now();
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(LOGIN_AT_KEY, String(now));
  sessionStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  localStorage.removeItem(TOKEN_KEY);
}

export function clearAccessToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(LOGIN_AT_KEY);
  sessionStorage.removeItem(LAST_ACTIVITY_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function touchActivity(): void {
  if (getAccessToken()) {
    sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  }
}

export function isSessionExpired(): boolean {
  const token = getAccessToken();
  if (!token) return true;

  const now = Date.now();
  const last = Number(sessionStorage.getItem(LAST_ACTIVITY_KEY) || 0);
  const loginAt = Number(sessionStorage.getItem(LOGIN_AT_KEY) || 0);
  const idleMs = getIdleMinutes() * 60 * 1000;
  const maxMs = getMaxSessionHours() * 60 * 60 * 1000;

  if (last > 0 && now - last > idleMs) return true;
  if (loginAt > 0 && now - loginAt > maxMs) return true;
  return false;
}

/** Drop legacy localStorage tokens from before session-based auth */
export function clearLegacyPersistentToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
