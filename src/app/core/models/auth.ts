import {Role} from './role';

export interface SignUpRequest {
  ruc: string;
  legalName: string;
  adminFullName: string;
  adminEmail: string;
  password: string;
}

export interface SignUpResponse {
  organizationId: string;
  administratorId: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

/** Respuesta de /auth/sign-in y /auth/refresh. */
export interface TokenResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  tokenType: string;
}

/** Sesión guardada en el navegador. */
export interface Session {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  userId: string;
  organizationId: string;
  role: Role;
}
