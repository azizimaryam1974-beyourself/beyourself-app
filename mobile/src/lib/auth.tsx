import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, tokenStore } from './api';

type AuthState = {
  token: string | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    tokenStore.get().then((t) => {
      setToken(t);
      setReady(true);
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { token: t } = await api.login(email, password);
    await tokenStore.set(t);
    setToken(t);
  }, []);

  const signOut = useCallback(async () => {
    const t = token;
    await tokenStore.clear();
    setToken(null);
    if (t) api.logout(t).catch(() => {});
  }, [token]);

  const value = useMemo(() => ({ token, ready, signIn, signOut }), [token, ready, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth außerhalb von AuthProvider');
  return v;
}
