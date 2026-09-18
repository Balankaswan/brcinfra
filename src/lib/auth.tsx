import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService, handleApiError } from './api';

interface User {
  id: string;
  name?: string;
  username?: string;
  email: string;
  role: string;
  lastLogin?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (userData: {name: string, email: string, password: string, role?: string}) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Force logout to show login page - clear any cached tokens
    localStorage.removeItem('auth_token');
    apiService.clearToken();
    setUser(null);
    setIsLoading(false);
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await apiService.getProfile();
      setUser(response.user);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      apiService.clearToken();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await apiService.login(email, password);
      setUser(response.user);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  };

  const logout = async () => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  };

  const register = async (userData: {name: string, email: string, password: string, role?: string}) => {
    try {
      const response = await apiService.register(userData);
      setUser(response.user);
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
