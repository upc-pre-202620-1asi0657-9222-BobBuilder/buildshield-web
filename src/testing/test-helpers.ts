import {Environment} from '../environments/environment.model';
import {TokenResponse} from '../app/core/models/auth';
import {Role} from '../app/core/models/role';
import {Subscription} from '../app/core/models/subscription';

/** Entorno de pruebas: reintentos rápidos y deterministas. */
export const TEST_ENV: Environment = {
  production: false,
  apiBaseUrl: '/api/v1',
  requestTimeoutMs: 60_000,
  maxNetworkRetries: 3,
  retryBaseDelayMs: 100,
  mockSprint2: false,
};

function base64Url(value: object): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** JWT sin firma válida, suficiente para que el cliente lea los claims. */
export function fakeJwt(role: Role, userId = 'user-1', org = 'org-1'): string {
  return `${base64Url({alg: 'RS256'})}.${base64Url({sub: userId, org, role})}.firma`;
}

export function fakeTokens(
  role: Role,
  overrides: Partial<TokenResponse> = {},
  accessTtlMs = 15 * 60_000,
): TokenResponse {
  const now = Date.now();
  return {
    accessToken: fakeJwt(role),
    accessTokenExpiresAt: new Date(now + accessTtlMs).toISOString(),
    refreshToken: 'refresh-1',
    refreshTokenExpiresAt: new Date(now + 7 * 24 * 3600_000).toISOString(),
    tokenType: 'Bearer',
    ...overrides,
  };
}

/** Suscripción de ejemplo: prueba gratuita de 14 días recién iniciada. */
export function fakeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-1',
    organizationId: 'org-1',
    plan: 'FREE',
    planName: 'Free',
    maxActiveWorksites: null,
    status: 'TRIAL',
    statusLabel: 'En prueba gratuita',
    billingPeriod: null,
    billingPeriodLabel: null,
    startedAt: '2026-10-11T15:00:00Z',
    currentPeriodStart: '2026-10-11T15:00:00Z',
    validUntil: '2026-10-25T15:00:00Z',
    nextBillingAt: null,
    pendingBillingPeriod: null,
    pendingChangeAt: null,
    paymentProvider: null,
    daysRemaining: 14,
    readOnly: false,
    ...overrides,
  };
}
