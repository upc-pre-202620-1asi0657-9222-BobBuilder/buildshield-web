import {Component, DestroyRef, OnInit, computed, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';

import {PublicPlansService} from '../../core/api/public-plans.service';
import {SubscriptionApiService} from '../../core/api/subscription-api.service';
import {toApiError} from '../../core/http/api-error';
import {PlanCode, PublicPlan} from '../../core/models/plan';
import {BILLING_PERIOD_LABELS, BillingPeriod} from '../../core/models/subscription';
import {SubscriptionStateService} from '../../core/subscription/subscription-state.service';
import {IconComponent} from '../../shared/icon.component';
import {formatMoney} from '../public/public-content';

/**
 * Pago simulado del entorno local (T73). Sin clave de Stripe, el checkout del
 * backend redirige aquí con `session_id`, `plan` y `billingPeriod`. Confirmar
 * firma y procesa el mismo evento que enviaría Stripe y vuelve a la suscripción.
 */
@Component({
  selector: 'app-simulated-payment-page',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <a class="eyebrow" routerLink="/suscripcion/planes">Planes</a>
          <h1>Pago simulado</h1>
        </div>
        <span class="badge badge-warn">Modo de demostración</span>
      </div>

      <div class="alert alert-warning" role="note" data-testid="demo-notice">
        <app-icon name="alert" />
        <div>
          <strong>Esto es una demostración, no un cobro real.</strong>
          En este entorno no hay clave de Stripe: esta página reemplaza a Stripe Checkout. No se pide tarjeta ni se
          mueve dinero. En producción, el botón de pagar lleva a la página segura de Stripe.
        </div>
      </div>
      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }

      @if (!sessionId) {
        <div class="empty">
          <strong>Falta la sesión de pago</strong>
          <p>Vuelve a los planes y elige uno para iniciar el pago.</p>
          <a class="btn" routerLink="/suscripcion/planes">Ver planes</a>
        </div>
      } @else {
        <div class="card">
          <h2>Resumen del pago</h2>
          <dl class="kv">
            <div>
              <dt>Plan</dt>
              <dd data-testid="sim-plan">{{ plan()?.name ?? planCode }}</dd>
            </div>
            <div>
              <dt>Modalidad</dt>
              <dd>{{ periodLabel() }}</dd>
            </div>
            <div>
              <dt>Monto</dt>
              <dd>{{ amount() }}</dd>
            </div>
            <div>
              <dt>Sesión</dt>
              <dd class="session">{{ sessionId }}</dd>
            </div>
          </dl>
          <div class="form-actions">
            <button class="btn btn-primary" type="button" [disabled]="confirming()" (click)="confirm()" data-testid="confirm-simulated">
              <app-icon name="check" />
              {{ confirming() ? 'Confirmando…' : 'Confirmar pago simulado' }}
            </button>
            <a class="btn btn-ghost" routerLink="/suscripcion" [queryParams]="{pago: 'cancelado'}">Cancelar y volver</a>
          </div>
        </div>
      }
    </section>
  `,
  styles: `
    .session {
      font-family: var(--bs-font);
      font-weight: 500;
      font-size: 0.8125rem;
      overflow-wrap: anywhere;
    }
  `,
})
export class SimulatedPaymentPageComponent implements OnInit {
  private readonly api = inject(SubscriptionApiService);
  private readonly state = inject(SubscriptionStateService);
  private readonly plans = inject(PublicPlansService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly params = inject(ActivatedRoute).snapshot.queryParamMap;

  protected readonly sessionId = this.params.get('session_id') ?? '';
  protected readonly planCode = (this.params.get('plan') ?? '') as PlanCode;
  private readonly billingPeriod = this.params.get('billingPeriod') as BillingPeriod | null;

  protected readonly catalog = signal<readonly PublicPlan[]>([]);
  protected readonly confirming = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly plan = computed(() => this.catalog().find((p) => p.code === this.planCode) ?? null);
  protected readonly periodLabel = computed(() =>
    this.billingPeriod && BILLING_PERIOD_LABELS[this.billingPeriod] ? BILLING_PERIOD_LABELS[this.billingPeriod] : '-',
  );
  protected readonly amount = computed(() => {
    const plan = this.plan();
    if (!plan || !this.billingPeriod) {
      return '-';
    }
    const value = this.billingPeriod === 'ANNUAL' ? plan.annualPrice : plan.monthlyPrice;
    return formatMoney(value, plan.currency);
  });

  ngOnInit(): void {
    this.plans
      .catalog()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((catalog) => this.catalog.set(catalog.plans));
  }

  protected confirm(): void {
    this.confirming.set(true);
    this.error.set(null);
    this.api.confirmSimulatedPayment(this.sessionId).subscribe({
      next: (sub) => {
        this.state.set(sub);
        void this.router.navigate(['/suscripcion'], {queryParams: {pago: 'exitoso'}});
      },
      error: (err: unknown) => {
        this.confirming.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }
}
