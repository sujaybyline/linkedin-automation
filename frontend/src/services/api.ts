import axios from "axios";
import { clearAccessToken, getAccessToken, touchActivity } from "../lib/sessionAuth";

function normalizeApiRoot(raw?: string): string {
  const trimmed = raw?.trim();
  if (trimmed) {
    let base = trimmed.replace(/\/+$/, "");
    if (!base.endsWith("/api")) base = `${base}/api`;
    return `${base}/`;
  }
  return "/api/";
}

export function resolveApiUrl(relativePath: string): string {
  const path = relativePath.replace(/^\//, "");
  const base = normalizeApiRoot(import.meta.env.VITE_API_URL);
  if (/^https?:\/\//i.test(base)) {
    return `${base}${path}`;
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}${base}${path}`;
  }
  return `${base}${path}`;
}

export const api = axios.create({
  baseURL: normalizeApiRoot(import.meta.env.VITE_API_URL),
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof config.url === "string" && config.url.startsWith("/")) {
    config.url = config.url.slice(1);
  }
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    touchActivity();
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      clearAccessToken();
      window.dispatchEvent(new CustomEvent("apex:session-expired"));
    }
    return Promise.reject(err);
  }
);

export interface ApiEnvelope<T> {
  data: T;
  error: { message: string } | null;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await api.get<ApiEnvelope<T>>(path);
  if (res.data.error) throw new Error(res.data.error.message);
  return res.data.data;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  try {
    const res = await api.post<ApiEnvelope<T>>(path, body);
    if (res.data.error) throw new Error(res.data.error.message);
    return res.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data?.error?.message) {
      throw new Error(err.response.data.error.message);
    }
    throw err;
  }
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await api.put<ApiEnvelope<T>>(path, body);
  if (res.data.error) throw new Error(res.data.error.message);
  return res.data.data;
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  try {
    const res = await api.patch<ApiEnvelope<T>>(path, body);
    if (res.data.error) throw new Error(res.data.error.message);
    return res.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data?.error?.message) {
      throw new Error(err.response.data.error.message);
    }
    throw err;
  }
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await api.delete<ApiEnvelope<T>>(path);
  if (res.data.error) throw new Error(res.data.error.message);
  return res.data.data;
}
