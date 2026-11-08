import {Injectable, inject, signal} from '@angular/core';
import {Subscription} from 'rxjs';

import {NotificationsApi} from '../../core/api/notifications-api';

/** Cada cuánto se consulta el contador de no leídas (contrato US43). */
export const UNREAD_POLL_MS = 60_000;

/**
 * Contador de notificaciones no leídas que comparten la campana del menú y la
 * bandeja. Se consulta cada 60 s y al cambiar de ruta; un error deja el último
 * valor conocido (la consulta siguiente lo corrige).
 */
@Injectable({providedIn: 'root'})
export class UnreadNotificationsService {
  private readonly api = inject(NotificationsApi);
  private inFlight: Subscription | null = null;

  private readonly countState = signal(0);
  readonly count = this.countState.asReadonly();

  refresh(): void {
    if (this.inFlight && !this.inFlight.closed) {
      return;
    }
    this.inFlight = this.api.unreadCount().subscribe({
      next: (count) => this.countState.set(Math.max(0, count)),
      // Sin conexión: se conserva el último valor.
      error: () => undefined,
    });
  }

  set(count: number): void {
    this.countState.set(Math.max(0, count));
  }

  decrement(): void {
    this.countState.update((c) => Math.max(0, c - 1));
  }
}
