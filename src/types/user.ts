import { User, Role } from '@prisma/client';

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  role: Role;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface UpdateUserData {
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
  sortBy?: 'createdAt' | 'email' | 'lastLoginAt' | 'role';
  sortOrder?: 'asc' | 'desc';
}

export interface UserListResponse {
  users: UserProfile[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export type PublicUser = Omit<
  User,
  'password' | 'passwordResetToken' | 'passwordResetExpires'
>;
