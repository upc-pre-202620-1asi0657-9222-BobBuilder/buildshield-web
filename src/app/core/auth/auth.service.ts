import {HttpClient, HttpContext} from '@angular/common/http';
import {Injectable, computed, inject, signal} from '@angular/core';
import {Observable, catchError, finalize, map, of, shareReplay, tap, throwError} from 'rxjs';

import {APP_ENV} from '../config/app-env';
import {SKIP_AUTH} from '../http/http-context';
import {
  Session,
  SignInRequest,
  SignUpRequest,
  SignUpResponse,
  TokenResponse,
} from '../models/auth';
import {Role, isRole} from '../models/role';
import {decodeJwt} from './jwt';

export const SESSION_STORAGE_KEY = 'buildshield.session';

/** Margen para renovar el token de acceso antes de que venza. */
const EXPIRY_MARGIN_MS = 30_000;

/**
 * Sesión del usuario: inicio y cierre de sesión, registro de la organización
 * y rotación del token de renovación (cada uso entrega un par nuevo).
 */
@Injectable({providedIn: 'root'})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly env = inject(APP_ENV);

  private readonly sessionState = signal<Session | null>(readStoredSession());
  private refreshInFlight: Observable<Session> | null = null;

  readonly session = this.sessionState.asReadonly();
  readonly role = computed<Role | null>(() => this.sessionState()?.role ?? null);
  readonly isAuthenticated = computed(() => {
    const session = this.sessionState();
    return session !== null && Date.parse(session.refreshTokenExpiresAt) > Date.now();
  });

  private get authUrl(): string {
    return `${this.env.apiBaseUrl}/auth`;
  }

  signUp(request: SignUpRequest): Observable<SignUpResponse> {
    return this.http.post<SignUpResponse>(`${this.authUrl}/sign-up`, request, {
      context: new HttpContext().set(SKIP_AUTH, true),
    });
  }

  signIn(request: SignInRequest): Observable<Session> {
    return this.http
      .post<TokenResponse>(`${this.authUrl}/sign-in`, request, {
        context: new HttpContext().set(SKIP_AUTH, true),
      })
      .pipe(map((tokens) => this.storeTokens(tokens)));
  }

  /**
   * Renueva la sesión con el token de renovación vigente. Las llamadas
   * simultáneas comparten una sola petición: el backend revoca el token usado,
   * así que enviarlo dos veces cerraría la sesión.
   */
  refresh(): Observable<Session> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }
    const current = this.sessionState();
    if (!current) {
      return throwError(() => new Error('Sin sesión'));
    }
    this.refreshInFlight = this.http
      .post<TokenResponse>(
        `${this.authUrl}/refresh`,
        {refreshToken: current.refreshToken},
        {context: new HttpContext().set(SKIP_AUTH, true)},
      )
      .pipe(
        map((tokens) => this.storeTokens(tokens)),
        catchError((error: unknown) => {
          this.clearSession();
          return throwError(() => error);
        }),
        finalize(() => {
          this.refreshInFlight = null;
        }),
        shareReplay({bufferSize: 1, refCount: false}),
      );
    return this.refreshInFlight;
  }

  /** Cierra la sesión en el backend (mejor esfuerzo) y la borra localmente. */
  signOut(): Observable<void> {
    const current = this.sessionState();
    if (!current) {
      return of(undefined);
    }
    return this.http
      .post<void>(`${this.authUrl}/sign-out`, {refreshToken: current.refreshToken})
      .pipe(
        catchError(() => of(undefined)),
        map(() => undefined),
        tap(() => this.clearSession()),
      );
  }

  /** Token de acceso actual o null. */
  accessToken(): string | null {
    return this.sessionState()?.accessToken ?? null;
  }

  /** Indica si el token de acceso vence en menos de 30 s. */
  accessTokenExpiresSoon(now: number = Date.now()): boolean {
    const session = this.sessionState();
    if (!session) {
      return false;
    }
    return Date.parse(session.accessTokenExpiresAt) - now < EXPIRY_MARGIN_MS;
  }

  hasAnyRole(roles: readonly Role[]): boolean {
    const role = this.role();
    return role !== null && roles.includes(role);
  }

  clearSession(): void {
    this.sessionState.set(null);
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Almacenamiento no disponible: la sesión solo vivía en memoria.
    }
  }

  private storeTokens(tokens: TokenResponse): Session {
    const claims = decodeJwt(tokens.accessToken);
    if (!isRole(claims.role)) {
      throw new Error('El token no trae un rol válido');
    }
    const session: Session = {
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshToken: tokens.refreshToken,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      userId: claims.sub ?? '',
      organizationId: claims.org ?? '',
      role: claims.role,
    };
    this.sessionState.set(session);
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Sin almacenamiento persistente: la sesión dura lo que la pestaña.
    }
    return session;
  }
}

function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.refreshToken !== 'string' ||
      typeof parsed.refreshTokenExpiresAt !== 'string' ||
      !isRole(parsed.role)
    ) {
      return null;
    }
    return parsed as Session;
  } catch {
    return null;
  }
}
