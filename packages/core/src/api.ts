import type {
  User,
  Organization,
  LoginResult,
  RegisterData,
  RegisterResult,
  SocleClientOptions,
} from './types';

export class ApiClient {
  private baseUrl: string;
  private credentials: RequestCredentials;
  private accessToken: string | null = null;

  constructor(options: SocleClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.credentials = options.credentials ?? 'same-origin';
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<{ ok: boolean; status: number; data: T }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
      credentials: this.credentials,
    });

    let data: T;
    try {
      data = await response.json();
    } catch {
      data = {} as T;
    }

    return { ok: response.ok, status: response.status, data };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const { ok, status, data } = await this.request<{
      user?: User;
      error?: string;
      requires2FA?: boolean;
      tempToken?: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (ok && data.user) {
      return { success: true, user: data.user };
    }

    if (status === 403 && data.requires2FA && data.tempToken) {
      return { success: false, requires2FA: true, tempToken: data.tempToken };
    }

    return { success: false, error: data.error ?? 'Login failed' };
  }

  async register(registerData: RegisterData): Promise<RegisterResult> {
    const { ok, data } = await this.request<{ user?: User; error?: string }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(registerData),
      }
    );

    if (ok && data.user) {
      return { success: true, user: data.user };
    }

    return { success: false, error: data.error ?? 'Registration failed' };
  }

  async logout(): Promise<void> {
    await this.request('/api/auth/logout', { method: 'POST' });
  }

  async getMe(): Promise<User | null> {
    const { ok, data } = await this.request<{ user?: User }>('/api/auth/me');

    if (ok && data.user) {
      return data.user;
    }

    return null;
  }

  async verify2FA(code: string, tempToken: string): Promise<LoginResult> {
    const { ok, data } = await this.request<{ user?: User; error?: string }>(
      '/api/auth/2fa/verify',
      {
        method: 'POST',
        body: JSON.stringify({ code, tempToken }),
      }
    );

    if (ok && data.user) {
      return { success: true, user: data.user };
    }

    return { success: false, error: data.error ?? '2FA verification failed' };
  }

  async refreshSession(): Promise<User | null> {
    const { ok, data } = await this.request<{ user?: User }>(
      '/api/auth/refresh',
      {
        method: 'POST',
      }
    );

    if (ok && data.user) {
      return data.user;
    }

    return null;
  }

  async getOrganizations(): Promise<Organization[]> {
    const { ok, data } = await this.request<{ organizations?: Organization[] }>(
      '/api/organizations'
    );

    return ok && data.organizations ? data.organizations : [];
  }

  async getCurrentOrganization(): Promise<Organization | null> {
    const { ok, data } = await this.request<{ organization?: Organization }>(
      '/api/organizations/current'
    );

    return ok && data.organization ? data.organization : null;
  }
}
