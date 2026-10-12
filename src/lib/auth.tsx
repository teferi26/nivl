import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { supabase } from './supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let authEventReceived = false;
    // Subscribe first: a login or logout while storage is loading takes
    // precedence over the earlier snapshot returned by getSession.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      authEventReceived = true;
      if (!active) return;
      setSession(next);
      setLoading(false);
    });
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active && !authEventReceived) setSession(data.session);
      })
      .catch(() => {
        if (active && !authEventReceived) setSession(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
