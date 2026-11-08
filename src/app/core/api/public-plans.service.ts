import {HttpClient, HttpContext} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable, catchError, map, of, timeout} from 'rxjs';

import {APP_ENV} from '../config/app-env';
import {SKIP_AUTH, SKIP_RETRY} from '../http/http-context';
import {PlanCatalog, PlanCode, PlanResponse, PublicPlan} from '../models/plan';

const PLAN_ORDER: readonly PlanCode[] = ['FREE', 'PLUS', 'PRO'];

/** Tiempo máximo para el catálogo público: la página no espera más que esto. */
export const PUBLIC_PLANS_TIMEOUT_MS = 4000;

/**
 * Respaldo estático con los supuestos vigentes de precios (US49). Se usa cuando
 * la API no responde o le faltan campos, para que la página nunca quede sin planes.
 */
export const FALLBACK_PLANS: readonly PublicPlan[] = [
  {
    code: 'FREE',
    name: 'Free',
    description: 'Prueba gratuita con todas las funciones',
    maxActiveWorksites: null,
    trialOnly: true,
    trialDays: 14,
    monthlyPrice: 0,
    annualPrice: 0,
    annualSavings: 0,
    annualDiscountPercent: 0,
    currency: 'PEN',
  },
  {
    code: 'PLUS',
    name: 'Plus',
    description: 'Hasta 5 obras activas, todas las funciones',
    maxActiveWorksites: 5,
    trialOnly: false,
    trialDays: null,
    monthlyPrice: 299,
    annualPrice: 2990,
    annualSavings: 598,
    annualDiscountPercent: 16.67,
    currency: 'PEN',
  },
  {
    code: 'PRO',
    name: 'Pro',
    description: 'Obras activas ilimitadas, todas las funciones',
    maxActiveWorksites: null,
    trialOnly: false,
    trialDays: null,
    monthlyPrice: 699,
    annualPrice: 6990,
    annualSavings: 1398,
    annualDiscountPercent: 16.67,
    currency: 'PEN',
  },
];

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Convierte un plan de la API; devuelve `null` si le falta algo que la página necesita. */
export function toPublicPlan(raw: PlanResponse): PublicPlan | null {
  const code = raw.code as PlanCode;
  if (!PLAN_ORDER.includes(code)) {
    return null;
  }
  const trialOnly = raw.trialOnly === true;
  const monthly = toNumber(raw.monthlyPrice);
  const annual = toNumber(raw.annualPrice);
  if (monthly === null || annual === null || (!trialOnly && (monthly <= 0 || annual <= 0))) {
    return null;
  }
  const yearAtMonthly = monthly * 12;
  const savings = toNumber(raw.annualSavings) ?? round2(Math.max(yearAtMonthly - annual, 0));
  const discount =
    toNumber(raw.annualDiscountPercent) ??
    (yearAtMonthly > 0 ? round2((savings / yearAtMonthly) * 100) : 0);
  const fallback = FALLBACK_PLANS.find((plan) => plan.code === code)!;
  const unlimited = raw.unlimitedWorksites === true || raw.maxActiveWorksites == null;
  return {
    code,
    name: raw.name?.trim() || fallback.name,
    description: raw.description?.trim() || fallback.description,
    maxActiveWorksites: unlimited ? null : (raw.maxActiveWorksites ?? null),
    trialOnly,
    trialDays: trialOnly ? (raw.trialDays ?? fallback.trialDays) : null,
    monthlyPrice: monthly,
    annualPrice: annual,
    annualSavings: savings,
    annualDiscountPercent: discount,
    currency: raw.currency?.trim() || 'PEN',
  };
}

/**
 * Catálogo de planes para visitantes sin sesión. Lee `GET /api/v1/plans` sin
 * token ni reintentos; si la llamada falla o la respuesta está incompleta,
 * entrega el respaldo estático.
 */
@Injectable({providedIn: 'root'})
export class PublicPlansService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(APP_ENV).apiBaseUrl;

  catalog(): Observable<PlanCatalog> {
    const context = new HttpContext().set(SKIP_AUTH, true).set(SKIP_RETRY, true);
    return this.http.get<unknown>(`${this.base}/plans`, {context}).pipe(
      timeout(PUBLIC_PLANS_TIMEOUT_MS),
      map((response) => this.fromResponse(response)),
      catchError(() => of(this.fallback())),
    );
  }

  private fromResponse(response: unknown): PlanCatalog {
    if (!Array.isArray(response)) {
      return this.fallback();
    }
    const plans: PublicPlan[] = [];
    for (const code of PLAN_ORDER) {
      const raw = (response as PlanResponse[]).find((plan) => plan?.code === code);
      const plan = raw ? toPublicPlan(raw) : null;
      if (!plan) {
        return this.fallback();
      }
      plans.push(plan);
    }
    return {plans, source: 'api'};
  }

  private fallback(): PlanCatalog {
    return {plans: FALLBACK_PLANS, source: 'fallback'};
  }
}
