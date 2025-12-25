import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  has2FA: boolean;
  hasPassword: boolean;
  hasVault: boolean;
  authMethods: {
    password: boolean;
    passkeys: number;
    oauth: string[];
  };
}

export interface Session {
  id: string;
  browser: string;
  os: string;
  device: string;
  ipAddress: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: true,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ user: null, token: null, isAuthenticated: false })
    }),
    {
      name: 'authforge-auth',
      partialize: (state) => ({ token: state.token })
    }
  )
);

// API client
const API_BASE = '/api';

interface ApiResponse<T> {
  success: boolean;
  error?: string;
  message?: string;
  data?: T;
}

export async function api<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAuthStore.getState().token;
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    },
    credentials: 'include'
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'An error occurred');
  }

  return data;
}

// Auth API functions
export const authApi = {
  async register(email: string, password: string, name?: string) {
    return api<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name })
    });
  },

  async login(email: string, password: string) {
    return api<{ user?: User; token?: string; requires2FA?: boolean; tempToken?: string }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password })
      }
    );
  },

  async verify2FA(tempToken: string, code: string) {
    return api<{ user: User; token: string }>('/auth/login/2fa', {
      method: 'POST',
      body: JSON.stringify({ tempToken, code })
    });
  },

  async requestMagicLink(email: string) {
    return api<{ message: string }>('/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  async logout() {
    return api<{ message: string }>('/auth/logout', { method: 'POST' });
  },

  async setup2FA() {
    return api<{ secret: string; qrCode: string; otpauthUrl: string }>(
      '/auth/2fa/setup',
      { method: 'POST' }
    );
  },

  async verify2FASetup(code: string) {
    return api<{ backupCodes: string[] }>('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
  },

  async disable2FA(code: string) {
    return api<{ message: string }>('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
  }
};

// User API functions
export const userApi = {
  async getMe() {
    return api<{ user: User }>('/users/me');
  },

  async updateProfile(data: { name?: string; avatarUrl?: string }) {
    return api<{ message: string }>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  async changePassword(currentPassword: string, newPassword: string) {
    return api<{ message: string }>('/users/me/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  },

  async getAuditLog(limit = 50, offset = 0) {
    return api<{ logs: any[]; pagination: { total: number } }>(
      `/users/me/audit-log?limit=${limit}&offset=${offset}`
    );
  },

  async deleteAccount(password: string, confirmation: string) {
    return api<{ message: string }>('/users/me', {
      method: 'DELETE',
      body: JSON.stringify({ password, confirmation })
    });
  }
};

// Sessions API
export const sessionsApi = {
  async list() {
    return api<{ sessions: Session[]; currentSessionId: string }>('/sessions');
  },

  async getCurrent() {
    return api<{ session: Session; user: User }>('/sessions/current');
  },

  async revoke(sessionId: string) {
    return api<{ message: string }>(`/sessions/${sessionId}`, { method: 'DELETE' });
  },

  async revokeAll() {
    return api<{ message: string }>('/sessions/revoke-all', { method: 'POST' });
  }
};
