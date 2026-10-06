import {Environment} from './environment.model';

/** Configuración de producción. La API se sirve detrás del mismo dominio. */
export const environment: Environment = {
  production: true,
  apiBaseUrl: '/api/v1',
  requestTimeoutMs: 15000,
  maxNetworkRetries: 3,
  retryBaseDelayMs: 500,
  mockSprint2: false,
};
