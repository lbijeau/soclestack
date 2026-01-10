import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type {
  SocleClient,
  AuthState,
  LoginResult,
  RegisterData,
  RegisterResult,
} from '@soclestack/core';

interface SocleContextValue {
  client: SocleClient;
  state: AuthState;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<RegisterResult>;
  verify2FA: (code: string, tempToken: string) => Promise<LoginResult>;
}

const SocleContext = createContext<SocleContextValue | null>(null);

export interface SocleProviderProps {
  client: SocleClient;
  children: ReactNode;
}

export function SocleProvider({ client, children }: SocleProviderProps) {
  const [state, setState] = useState<AuthState>(client.getState());

  useEffect(() => {
    // Subscribe to state changes
    const unsubscribe = client.subscribe(setState);

    // Initialize client (check existing session)
    client.initialize();

    return unsubscribe;
  }, [client]);

  const login = useCallback(
    (email: string, password: string) => client.login(email, password),
    [client]
  );

  const logout = useCallback(() => client.logout(), [client]);

  const register = useCallback(
    (data: RegisterData) => client.register(data),
    [client]
  );

  const verify2FA = useCallback(
    (code: string, tempToken: string) => client.verify2FA(code, tempToken),
    [client]
  );

  const value: SocleContextValue = {
    client,
    state,
    login,
    logout,
    register,
    verify2FA,
  };

  return (
    <SocleContext.Provider value={value}>{children}</SocleContext.Provider>
  );
}

export function useSocleContext(): SocleContextValue {
  const context = useContext(SocleContext);
  if (!context) {
    throw new Error('useSocleContext must be used within a SocleProvider');
  }
  return context;
}
