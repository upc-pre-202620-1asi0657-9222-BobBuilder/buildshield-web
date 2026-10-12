import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';

import {APP_ENV} from '../config/app-env';
import {PlanCode} from '../models/plan';
import {
  BillingPeriod,
  BillingPeriodChange,
  CheckoutSession,
  Subscription,
} from '../models/subscription';

/** Suscripción, pago con Stripe Checkout (o simulado) y cambio de modalidad (US07 a US12). */
@Injectable({providedIn: 'root'})
export class SubscriptionApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_ENV).apiBaseUrl}/subscriptions`;

  current(): Observable<Subscription> {
    return this.http.get<Subscription>(`${this.base}/current`);
  }

  /** Solo administrador. Devuelve la URL de Checkout a la que hay que redirigir. */
  checkout(plan: PlanCode, billingPeriod: BillingPeriod): Observable<CheckoutSession> {
    return this.http.post<CheckoutSession>(`${this.base}/checkout`, {plan, billingPeriod});
  }

  /** Solo en el modo simulado de desarrollo: completa el pago de la sesión. */
  confirmSimulatedPayment(sessionId: string): Observable<Subscription> {
    return this.http.post<Subscription>(
      `${this.base}/checkout/${encodeURIComponent(sessionId)}/simulated-payment`,
      null,
    );
  }

  /** Programa el cambio de modalidad para la próxima fecha de cobro (o lo cancela). */
  changeBillingPeriod(billingPeriod: BillingPeriod): Observable<BillingPeriodChange> {
    return this.http.put<BillingPeriodChange>(`${this.base}/current/billing-period`, {billingPeriod});
  }
}
