import {PlanCode} from './plan';

/** Suscripción de la organización (subscription-service, Sprint 4). */

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED';
export type BillingPeriod = 'MONTHLY' | 'ANNUAL';
export type PaymentProvider = 'STRIPE' | 'SIMULATED';

export const SUBSCRIPTION_STATUS_LABELS: Readonly<Record<SubscriptionStatus, string>> = {
  TRIAL: 'En prueba gratuita',
  ACTIVE: 'Activa',
  EXPIRED: 'Vencida',
};

export const BILLING_PERIOD_LABELS: Readonly<Record<BillingPeriod, string>> = {
  MONTHLY: 'Mensual',
  ANNUAL: 'Anual',
};

/** Respuesta de `GET /subscriptions/current`. */
export interface Subscription {
  id: string;
  organizationId: string;
  plan: PlanCode;
  planName: string;
  /** Obras activas permitidas; nulo cuando son ilimitadas. */
  maxActiveWorksites: number | null;
  status: SubscriptionStatus;
  statusLabel: string;
  billingPeriod: BillingPeriod | null;
  billingPeriodLabel: string | null;
  /** Alta de la suscripción: inicio de la prueba gratuita. */
  startedAt: string;
  currentPeriodStart: string | null;
  validUntil: string;
  nextBillingAt: string | null;
  pendingBillingPeriod: BillingPeriod | null;
  pendingChangeAt: string | null;
  paymentProvider: PaymentProvider | null;
  daysRemaining: number;
  readOnly: boolean;
}

/** Respuesta de `POST /subscriptions/checkout`. */
export interface CheckoutSession {
  sessionId: string;
  checkoutUrl: string;
  plan: PlanCode;
  billingPeriod: BillingPeriod;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  simulated: boolean;
  reused: boolean;
  status: string;
}

export type BillingPeriodOutcome = 'SCHEDULED' | 'CANCELLED' | 'UNCHANGED';

/** Respuesta de `PUT /subscriptions/current/billing-period`. */
export interface BillingPeriodChange {
  outcome: BillingPeriodOutcome;
  subscription: Subscription;
}

/** Días que faltan para que la prueba gratuita termine y se avise (US06). */
export const TRIAL_WARNING_DAYS = 3;
