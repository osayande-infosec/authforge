import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt?: string;
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
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: true,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => {
        clearCSRFToken();
        set({ user: null, token: null, isAuthenticated: false });
      },
      refreshUser: async () => {
        const token = get().token;
        if (!token) return;
        try {
          const response = await fetch(`${API_BASE}/users/me`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            credentials: 'include'
          });
          if (response.ok) {
            const data = await response.json();
            set({ user: data.user, isAuthenticated: true });
          }
        } catch (error) {
          console.error('Failed to refresh user:', error);
        }
      }
    }),
    {
      name: 'authforge-auth',
      partialize: (state) => ({ token: state.token })
    }
  )
);

// API client
const API_BASE = '/api';

// CSRF token management
let csrfToken: string | null = null;

async function fetchCSRFToken(): Promise<string | null> {
  const token = useAuthStore.getState().token;
  if (!token) return null;
  
  try {
    const response = await fetch(`${API_BASE}/sessions/csrf-token`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      credentials: 'include'
    });
    if (response.ok) {
      const data = await response.json();
      csrfToken = data.csrfToken;
      return csrfToken;
    }
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
  }
  return null;
}

// Get CSRF token, fetching if needed
async function getCSRFToken(): Promise<string | null> {
  if (csrfToken) return csrfToken;
  return fetchCSRFToken();
}

// Clear CSRF token on logout
export function clearCSRFToken() {
  csrfToken = null;
}

export async function api<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAuthStore.getState().token;
  const method = options.method?.toUpperCase() || 'GET';
  
  // For state-changing requests, include CSRF token
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {})
  };

  // Add CSRF token for mutations (POST, PUT, PATCH, DELETE)
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && token) {
    const csrf = await getCSRFToken();
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  const data = await response.json();

  if (!response.ok) {
    // If CSRF token is invalid, refresh it and retry once
    if (response.status === 403 && data.error?.includes('CSRF')) {
      csrfToken = null;
      const newCsrf = await fetchCSRFToken();
      if (newCsrf) {
        headers['X-CSRF-Token'] = newCsrf;
        const retryResponse = await fetch(`${API_BASE}${endpoint}`, {
          ...options,
          headers,
          credentials: 'include'
        });
        const retryData = await retryResponse.json();
        if (!retryResponse.ok) {
          throw new Error(retryData.error || 'An error occurred');
        }
        return retryData;
      }
    }
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
  },

  // Passkey authentication (for login)
  async passkeyAuthStart(email?: string) {
    return api<{ success: boolean; challengeId: string; options: any }>('/passkeys/authenticate/start', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  async passkeyAuthComplete(challengeId: string, credential: any) {
    return api<{ success: boolean; user: User; token: string }>('/passkeys/authenticate/complete', {
      method: 'POST',
      body: JSON.stringify({ challengeId, credential })
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

  async changePassword(currentPassword: string | undefined, newPassword: string) {
    const body: { newPassword: string; currentPassword?: string } = { newPassword };
    if (currentPassword) {
      body.currentPassword = currentPassword;
    }
    return api<{ message: string }>('/users/me/password', {
      method: 'POST',
      body: JSON.stringify(body)
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
  },

  // Request email verification - sends link to email (check console in dev mode)
  async requestEmailVerification() {
    return api<{ success: boolean; message: string; devMode?: boolean }>('/users/me/verify-email', {
      method: 'POST'
    });
  },

  // Demo mode only - instant verification (disabled in production)
  async verifyEmailDemo() {
    return api<{ message: string }>('/users/me/verify-email-demo', {
      method: 'POST'
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
