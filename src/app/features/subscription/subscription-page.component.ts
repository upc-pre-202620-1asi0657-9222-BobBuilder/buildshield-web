import {DatePipe} from '@angular/common';
import {Component, DestroyRef, OnInit, computed, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {Observable, catchError, map, of, switchMap, throwError, timer} from 'rxjs';

import {PublicPlansService} from '../../core/api/public-plans.service';
import {SubscriptionApiService} from '../../core/api/subscription-api.service';
import {toApiError} from '../../core/http/api-error';
import {PublicPlan} from '../../core/models/plan';
import {
  BILLING_PERIOD_LABELS,
  BillingPeriod,
  Subscription,
} from '../../core/models/subscription';
import {SubscriptionStateService, daysLeftLabel} from '../../core/subscription/subscription-state.service';
import {IconComponent} from '../../shared/icon.component';
import {formatMoney} from '../public/public-content';

/** Reintentos mientras la suscripción recién se crea por evento (registro) o se confirma el pago. */
export const SUBSCRIPTION_WAIT_ATTEMPTS = 8;
export const SUBSCRIPTION_WAIT_MS = 1000;

/** Clase de insignia por estado de la suscripción. */
export function subscriptionBadge(sub: Subscription): string {
  if (sub.readOnly || sub.status === 'EXPIRED') {
    return 'badge-bad';
  }
  return sub.status === 'ACTIVE' ? 'badge-ok' : 'badge-warn';
}

/**
 * T69, T76 y T77 (US05, US11 y US12): suscripción de la organización. Al
 * registrarse, el administrador llega aquí con la bienvenida de la prueba
 * gratuita; también es el retorno de Stripe Checkout y del pago simulado.
 */
@Component({
  selector: 'app-subscription-page',
  standalone: true,
  imports: [DatePipe, RouterLink, IconComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <p class="eyebrow muted">Cuenta de la organización</p>
          <h1>Suscripción</h1>
        </div>
        @if (sub(); as s) {
          @if (s.status !== 'ACTIVE' || s.readOnly) {
            <div class="actions">
              <a class="btn btn-primary" routerLink="/suscripcion/planes">
                <app-icon name="card" />
                Elegir un plan
              </a>
            </div>
          }
        }
      </div>

      @if (payment() === 'exitoso') {
        @if (sub()?.status === 'ACTIVE' && !sub()?.readOnly) {
          <p class="alert alert-success" role="status" data-testid="payment-ok">
            Pago confirmado. El plan {{ sub()?.planName }} está activo y la cuenta acepta cambios otra vez.
          </p>
        } @else if (!loading()) {
          <p class="alert alert-info" role="status">
            Recibimos el retorno del pago. La confirmación de la pasarela puede tardar unos segundos: recarga esta página.
          </p>
        }
      } @else if (payment() === 'cancelado') {
        <p class="alert alert-warning" role="status">Cancelaste el pago. La suscripción no cambió.</p>
      }
      @if (message()) {
        <p class="alert alert-success" role="status">{{ message() }}</p>
      }
      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }

      @if (loading()) {
        <p class="loading">Cargando la suscripción…</p>
      } @else if (sub()) {
        @if (sub(); as s) {
        @if (welcome() && s.status === 'TRIAL') {
          <div class="card welcome" data-testid="trial-welcome">
            <h2>Tu prueba gratuita ya empezó</h2>
            <p>
              La organización quedó registrada el <strong>{{ s.startedAt | date: "d 'de' MMMM 'de' y" }}</strong>.
              Tienes todas las funciones hasta el <strong>{{ s.validUntil | date: "d 'de' MMMM" }}</strong>:
              <strong data-testid="trial-days">{{ daysLeft() }}</strong>.
            </p>
            <p class="muted">
              Al terminar la prueba, la cuenta queda en solo lectura hasta que pagues el plan Plus o el plan Pro.
              Te avisaremos en la navegación cuando falten 3 días.
            </p>
            <div class="form-actions">
              <a class="btn btn-primary" routerLink="/users">
                <app-icon name="users" />
                Registrar a mi equipo
              </a>
              <a class="btn" routerLink="/suscripcion/planes">Ver planes</a>
            </div>
          </div>
        }

        <div class="card">
          <h2>
            Plan {{ s.planName }}
            <span class="badge" [class]="'badge ' + badge()">{{ s.readOnly ? 'Solo lectura' : s.statusLabel }}</span>
          </h2>
          <dl class="kv">
            <div>
              <dt>Modalidad</dt>
              <dd>{{ s.billingPeriodLabel ?? 'Prueba gratuita' }}</dd>
            </div>
            <div>
              <dt>Obras activas permitidas</dt>
              <dd>{{ s.maxActiveWorksites ?? 'Ilimitadas' }}</dd>
            </div>
            <div>
              <dt>Inicio de la suscripción</dt>
              <dd>{{ s.startedAt | date: 'dd/MM/yyyy' }}</dd>
            </div>
            <div>
              <dt>Inicio del periodo actual</dt>
              <dd>{{ s.currentPeriodStart ? (s.currentPeriodStart | date: 'dd/MM/yyyy') : '-' }}</dd>
            </div>
            <div>
              <dt>{{ s.status === 'TRIAL' ? 'Fin de la prueba' : 'Vigente hasta' }}</dt>
              <dd>{{ s.validUntil | date: 'dd/MM/yyyy' }}</dd>
            </div>
            <div>
              <dt>Próxima fecha de cobro</dt>
              <dd data-testid="next-billing">{{ s.nextBillingAt ? (s.nextBillingAt | date: 'dd/MM/yyyy') : 'Sin cobro programado' }}</dd>
            </div>
            <div>
              <dt>Días restantes</dt>
              <dd>{{ s.daysRemaining }}</dd>
            </div>
            <div>
              <dt>Medio de pago</dt>
              <dd>{{ providerLabel() }}</dd>
            </div>
          </dl>
          @if (s.readOnly) {
            <p class="alert alert-error">
              La suscripción venció: la cuenta está en solo lectura. Elige un plan y paga para volver a registrar cambios.
            </p>
          }
        </div>

        @if (s.status === 'ACTIVE' && !s.readOnly && s.billingPeriod; as current) {
          <div class="card" data-testid="billing-period">
            <h2>Modalidad de cobro</h2>
            @if (s.pendingBillingPeriod && s.pendingBillingPeriod !== current) {
              <p class="alert alert-info" data-testid="pending-change">
                Cambio programado: desde el {{ s.pendingChangeAt | date: 'dd/MM/yyyy' }} pagarás en modalidad
                {{ periodLabel(s.pendingBillingPeriod).toLowerCase() }}.
              </p>
              <p class="muted">Si prefieres seguir con la modalidad {{ periodLabel(current).toLowerCase() }}, cancela el cambio.</p>
              <button class="btn" type="button" [disabled]="saving()" (click)="changePeriod(current)">
                {{ saving() ? 'Cancelando…' : 'Mantener ' + periodLabel(current).toLowerCase() }}
              </button>
            } @else {
              <p>
                Hoy pagas en modalidad <strong>{{ periodLabel(current).toLowerCase() }}</strong>.
                El cambio rige desde la próxima fecha de cobro, sin cobros prorrateados ni pérdida de días pagados.
              </p>
              @if (otherPeriod() === 'ANNUAL' && plan(); as p) {
                <p class="muted">
                  Con la modalidad anual pagas {{ money(p.annualPrice) }} al año y ahorras {{ money(p.annualSavings) }}
                  frente a doce pagos mensuales.
                </p>
              }
              <button class="btn" type="button" [disabled]="saving()" (click)="changePeriod(otherPeriod())" data-testid="change-period">
                {{ saving() ? 'Programando…' : 'Cambiar a ' + periodLabel(otherPeriod()).toLowerCase() }}
              </button>
            }
          </div>
        }
        }
      } @else if (!error()) {
        <div class="empty">
          <strong>La suscripción todavía no aparece</strong>
          <p>Se crea unos segundos después de registrar la organización. Recarga la página.</p>
          <button class="btn" type="button" (click)="load()">
            <app-icon name="refresh" />
            Recargar
          </button>
        </div>
      }
    </section>
  `,
  styles: `
    .welcome {
      border-color: var(--bs-asfalto);
      border-width: 1.5px;
    }
    h2 .badge {
      margin-left: 8px;
    }
  `,
})
export class SubscriptionPageComponent implements OnInit {
  private readonly api = inject(SubscriptionApiService);
  private readonly state = inject(SubscriptionStateService);
  private readonly plans = inject(PublicPlansService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sub = signal<Subscription | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly catalog = signal<readonly PublicPlan[]>([]);

  protected readonly welcome = signal(false);
  protected readonly payment = signal<'exitoso' | 'cancelado' | null>(null);

  protected readonly badge = computed(() => {
    const s = this.sub();
    return s ? subscriptionBadge(s) : '';
  });
  protected readonly daysLeft = computed(() => daysLeftLabel(this.sub()?.daysRemaining ?? 0).toLowerCase());
  protected readonly otherPeriod = computed<BillingPeriod>(() =>
    this.sub()?.billingPeriod === 'ANNUAL' ? 'MONTHLY' : 'ANNUAL',
  );
  protected readonly plan = computed(() => this.catalog().find((p) => p.code === this.sub()?.plan) ?? null);
  protected readonly providerLabel = computed(() => {
    switch (this.sub()?.paymentProvider) {
      case 'STRIPE':
        return 'Tarjeta en Stripe';
      case 'SIMULATED':
        return 'Pago simulado (demostración)';
      default:
        return 'Sin pago (prueba)';
    }
  });

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.welcome.set(params.get('bienvenida') === '1');
    const pago = params.get('pago');
    this.payment.set(pago === 'exitoso' || pago === 'cancelado' ? pago : null);
    this.plans
      .catalog()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((catalog) => this.catalog.set(catalog.plans));
    this.load();
  }

  protected periodLabel(period: BillingPeriod): string {
    return BILLING_PERIOD_LABELS[period];
  }

  protected money(amount: number): string {
    return formatMoney(amount, this.plan()?.currency ?? 'PEN');
  }

  /**
   * Lee la suscripción. Recién registrada la organización, la suscripción llega
   * por evento (404 por unos segundos); al volver de pagar, la activación puede
   * demorar lo que tarda el webhook. En ambos casos se reintenta un poco.
   */
  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const waitForPayment = this.payment() === 'exitoso';
    this.waitFor(waitForPayment)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sub) => {
          this.sub.set(sub);
          this.state.set(sub);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          const apiError = toApiError(err);
          if (apiError.code !== 'SUBSCRIPTION_NOT_FOUND') {
            this.error.set(apiError.message);
          }
        },
      });
  }

  protected changePeriod(period: BillingPeriod): void {
    this.saving.set(true);
    this.error.set(null);
    this.message.set(null);
    this.api.changeBillingPeriod(period).subscribe({
      next: (change) => {
        this.saving.set(false);
        this.sub.set(change.subscription);
        this.state.set(change.subscription);
        const s = change.subscription;
        switch (change.outcome) {
          case 'SCHEDULED':
            this.message.set(
              `Cambio programado: desde la próxima fecha de cobro pagarás en modalidad ${this.periodLabel(period).toLowerCase()}.`,
            );
            break;
          case 'CANCELLED':
            this.message.set(`Se canceló el cambio. Sigues en modalidad ${(s.billingPeriodLabel ?? '').toLowerCase()}.`);
            break;
          default:
            this.message.set('No hubo cambios en la modalidad.');
        }
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }

  private waitFor(untilActive: boolean, attempt = 1): Observable<Subscription> {
    return this.api.current().pipe(
      map((sub): Subscription | null => sub),
      catchError((err: unknown) => {
        const apiError = toApiError(err);
        if (apiError.code === 'SUBSCRIPTION_NOT_FOUND' && attempt < SUBSCRIPTION_WAIT_ATTEMPTS) {
          return of(null);
        }
        return throwError(() => apiError);
      }),
      switchMap((sub) => {
        const settled =
          sub !== null &&
          (!untilActive || (sub.status === 'ACTIVE' && !sub.readOnly) || attempt >= SUBSCRIPTION_WAIT_ATTEMPTS);
        return settled
          ? of(sub as Subscription)
          : timer(SUBSCRIPTION_WAIT_MS).pipe(switchMap(() => this.waitFor(untilActive, attempt + 1)));
      }),
    );
  }
}
