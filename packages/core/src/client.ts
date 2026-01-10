import type {
  AuthState,
  Organization,
  LoginResult,
  RegisterData,
  RegisterResult,
  SocleClientOptions,
  TokenStorage,
  Unsubscribe,
} from './types';
import { ApiClient } from './api';
import { createStorage } from './storage';

export class SocleClient {
  private api: ApiClient;
  private storage: TokenStorage;
  private state: AuthState = { status: 'loading' };
  private listeners: Set<(state: AuthState) => void> = new Set();
  private currentOrganization: Organization | null = null;

  constructor(options: SocleClientOptions) {
    this.api = new ApiClient(options);
    this.storage = options.tokenStorage ?? createStorage();

    // Restore token from storage
    const storedToken = this.storage.getAccessToken();
    if (storedToken) {
      this.api.setAccessToken(storedToken);
    }
  }

  /**
   * Get current auth state
   */
  getState(): AuthState {
    return this.state;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: AuthState) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(newState: AuthState): void {
    this.state = newState;
    this.listeners.forEach((listener) => listener(newState));
  }

  /**
   * Initialize client - check for existing session
   */
  async initialize(): Promise<void> {
    try {
      const user = await this.api.getMe();
      if (user) {
        const org = await this.api.getCurrentOrganization();
        this.currentOrganization = org;
        this.setState({
          status: 'authenticated',
          user,
          organization: org ?? undefined,
        });
      } else {
        this.storage.clear();
        this.setState({ status: 'unauthenticated' });
      }
    } catch (error) {
      this.storage.clear();
      this.setState({
        status: 'error',
        error: error instanceof Error ? error : new Error('Initialization failed'),
      });
    }
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<LoginResult> {
    const result = await this.api.login(email, password);

    if (result.success) {
      this.setState({
        status: 'authenticated',
        user: result.user,
        organization: this.currentOrganization ?? undefined,
      });
    } else {
      this.setState({ status: 'unauthenticated' });
    }

    return result;
  }

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<RegisterResult> {
    const result = await this.api.register(data);

    if (result.success) {
      this.setState({
        status: 'authenticated',
        user: result.user,
      });
    }

    return result;
  }

  /**
   * Verify 2FA code
   */
  async verify2FA(code: string, tempToken: string): Promise<LoginResult> {
    const result = await this.api.verify2FA(code, tempToken);

    if (result.success) {
      this.setState({
        status: 'authenticated',
        user: result.user,
        organization: this.currentOrganization ?? undefined,
      });
    }

    return result;
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    await this.api.logout();
    this.storage.clear();
    this.api.setAccessToken(null);
    this.currentOrganization = null;
    this.setState({ status: 'unauthenticated' });
  }

  /**
   * Refresh session
   */
  async refreshSession(): Promise<void> {
    const user = await this.api.refreshSession();
    if (user) {
      this.setState({
        status: 'authenticated',
        user,
        organization: this.currentOrganization ?? undefined,
      });
    } else {
      this.storage.clear();
      this.setState({ status: 'unauthenticated' });
    }
  }

  /**
   * Get current organization
   */
  getCurrentOrganization(): Organization | null {
    return this.currentOrganization;
  }

  /**
   * Switch to different organization
   */
  async switchOrganization(orgId: string): Promise<void> {
    const orgs = await this.api.getOrganizations();
    const org = orgs.find((o) => o.id === orgId);
    if (org) {
      this.currentOrganization = org;
      if (this.state.status === 'authenticated') {
        this.setState({
          ...this.state,
          organization: org,
        });
      }
    }
  }

  /**
   * Access to raw API client for custom calls
   */
  get rawApi(): ApiClient {
    return this.api;
  }
}
