export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AuthSession {
  id: string;
  token?: string;
  userId: string;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface SessionContext {
  user: AuthUser;
  session: AuthSession;
}
