import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@workspace/api-client-react';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('md_user');
      const storedToken = localStorage.getItem('md_token');
      if (storedUser && storedToken) {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      }
    } catch (e) {
      console.error('Failed to load auth state', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const login = (userData: User, authToken: string) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('md_user', JSON.stringify(userData));
    localStorage.setItem('md_token', authToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('md_user');
    localStorage.removeItem('md_token');
    window.location.href = '/login';
  };

  const updateUser = (userData: User) => {
    setUser(userData);
    localStorage.setItem('md_user', JSON.stringify(userData));
  };

  if (!isLoaded) return null;

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!user && !!token, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
