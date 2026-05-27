import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';
import { jwtDecode } from 'jwt-decode';

interface User {
  id: number;
  username: string;
  email: string;
  tenant: number | null;
  tenant_name: string;
  role: 'ADMIN' | 'ANALYST';
  first_name: string;
  last_name: string;
}

interface DecodedToken {
  user_id: number;
  username: string;
  role: 'ADMIN' | 'ANALYST';
  tenant_id: number | null;
  tenant_name: string;
  exp: number;
}

export interface RegisterPayload {
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  tenant: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const persistSession = (access: string, refresh: string, userData: User) => {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  useEffect(() => {
    const initAuth = async () => {
      const accessToken = localStorage.getItem('access_token');
      const cachedUser = localStorage.getItem('user');

      if (accessToken && cachedUser) {
        try {
          const decoded = jwtDecode<DecodedToken>(accessToken);
          const currentTime = Date.now() / 1000;

          if (decoded.exp < currentTime) {
            logout();
          } else {
            setUser(JSON.parse(cachedUser));
          }
        } catch {
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
      const response = await api.post('auth/login/', { username, password });
      const { access, refresh, user: userData } = response.data;
      persistSession(access, refresh, userData);
    } catch (error) {
      logout();
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload: RegisterPayload) => {
    setLoading(true);
    try {
      const response = await api.post('auth/register/', payload);
      const { access, refresh, user: userData } = response.data;
      persistSession(access, refresh, userData);
    } catch (error) {
      logout();
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
