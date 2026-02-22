import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: !!localStorage.getItem('auth_token'),
  token: localStorage.getItem('auth_token'),
  
  login: (token: string) => {
    localStorage.setItem('auth_token', token);
    set({ isAuthenticated: true, token });
  },
  
  logout: () => {
    localStorage.removeItem('auth_token');
    set({ isAuthenticated: false, token: null });
  },
  
  checkAuth: () => {
    const token = localStorage.getItem('auth_token');
    set({ isAuthenticated: !!token, token });
  },
}));
