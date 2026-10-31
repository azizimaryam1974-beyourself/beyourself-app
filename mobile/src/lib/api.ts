import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_URL } from './config';

const TOKEN_KEY = 'by_token';

export type Lang = { code: string; labelDe: string; nativeLabel: string; rtl: boolean; ttsVoice: string };
export type Me = {
  user: { name: string; email: string; role: 'student' | 'teacher' };
  package: { status: 'booked' | 'paid'; language: string; price: string } | null;
  language: Lang | null;
  canSpeak: boolean;
  packagePrice: string;
  lessons: { id: string; title: string; status: 'live' | 'ended'; startedAt: string }[];
};
export type Caption = { seq: number; original: string; text: string | null; error?: string };

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Token sicher im iPhone-Schlüsselbund; im Browser (nur Vorschau) im localStorage. */
const web = Platform.OS === 'web';
export const tokenStore = {
  get: async () => (web ? globalThis.localStorage?.getItem(TOKEN_KEY) ?? null : SecureStore.getItemAsync(TOKEN_KEY)),
  set: async (t: string) => (web ? globalThis.localStorage?.setItem(TOKEN_KEY, t) : SecureStore.setItemAsync(TOKEN_KEY, t)),
  clear: async () => (web ? globalThis.localStorage?.removeItem(TOKEN_KEY) : SecureStore.deleteItemAsync(TOKEN_KEY)),
};

async function request<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError('Keine Verbindung. Bitte Internet prüfen.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error || `Fehler ${res.status}`, res.status);
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; expiresAt: number }>('/api/app/login', null, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: (token: string) => request<{ ok: true }>('/api/app/logout', token, { method: 'POST' }),
  me: (token: string) => request<Me>('/api/app/me', token),
  lesson: (token: string, id: string) =>
    request<{ lesson: { id: string; title: string; status: 'live' | 'ended' }; captions: Caption[] }>(
      `/api/app/lessons/${encodeURIComponent(id)}`,
      token,
    ),
};
