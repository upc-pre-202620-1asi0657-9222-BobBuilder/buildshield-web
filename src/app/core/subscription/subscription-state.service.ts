import {Injectable, computed, inject, signal} from '@angular/core';
import {Subscription as RxSubscription} from 'rxjs';

import {SubscriptionApiService} from '../api/subscription-api.service';
import {Subscription, TRIAL_WARNING_DAYS} from '../models/subscription';

/**
 * Estado de la suscripción que comparten la navegación (días de prueba, US06),
 * el aviso de cuenta en solo lectura (US10) y la pantalla de suscripción.
 * Se consulta al entrar a la aplicación y después de pagar; además, cualquier
 * 402 SUBSCRIPTION_READ_ONLY de la API marca la cuenta en solo lectura al instante.
 */
@Injectable({providedIn: 'root'})
export class SubscriptionStateService {
  private readonly api = inject(SubscriptionApiService);
  private inFlight: RxSubscription | null = null;

  private readonly current = signal<Subscription | null>(null);
  /** El backend rechazó una escritura con 402 antes de que la consulta lo supiera. */
  private readonly blockedByApi = signal(false);

  readonly subscription = this.current.asReadonly();

  readonly readOnly = computed(() => this.blockedByApi() || this.current()?.readOnly === true);

  readonly inTrial = computed(() => this.current()?.status === 'TRIAL' && !this.readOnly());

  /** Aviso cuando quedan 3 días o menos de prueba gratuita. */
  readonly trialEndingSoon = computed(() => {
    const sub = this.current();
    return this.inTrial() && sub !== null && sub.daysRemaining <= TRIAL_WARNING_DAYS;
  });

  refresh(): void {
    if (this.inFlight && !this.inFlight.closed) {
      return;
    }
    this.inFlight = this.api.current().subscribe({
      next: (sub) => this.set(sub),
      // Sin suscripción todavía (evento demorado) o sin red: se conserva lo último.
      error: () => undefined,
    });
  }

  set(sub: Subscription): void {
    this.current.set(sub);
    this.blockedByApi.set(sub.readOnly);
  }

  markReadOnly(): void {
    this.blockedByApi.set(true);
  }

  clear(): void {
    this.inFlight?.unsubscribe();
    this.current.set(null);
    this.blockedByApi.set(false);
  }
}

/** Texto corto de los días que quedan: «Queda 1 día», «Quedan 12 días», «Último día». */
export function daysLeftLabel(days: number): string {
  if (days <= 0) {
    return 'Último día';
  }
  return days === 1 ? 'Queda 1 día' : `Quedan ${days} días`;
}
