import {DatePipe} from '@angular/common';
import {Component, DestroyRef, OnInit, computed, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Router, RouterLink} from '@angular/router';

import {PublicPlansService} from '../../core/api/public-plans.service';
import {SubscriptionApiService} from '../../core/api/subscription-api.service';
import {toApiError} from '../../core/http/api-error';
import {PlanCode, PublicPlan} from '../../core/models/plan';
import {BILLING_PERIOD_LABELS, BillingPeriod, Subscription} from '../../core/models/subscription';
import {SubscriptionStateService, daysLeftLabel} from '../../core/subscription/subscription-state.service';
import {BrowserLocation} from '../../core/util/browser-location';
import {IconComponent} from '../../shared/icon.component';
import {formatMoney, formatPercent} from '../public/public-content';

/**
 * T71 y T72 (US07 y US08): planes dentro de la aplicación. El administrador
 * elige Plus o Pro, mensual o anual (con el ahorro de `GET /plans`) y paga en
 * Stripe Checkout; en local, la URL de Checkout lleva al pago simulado.
 */
@Component({
  selector: 'app-plans-page',
  standalone: true,
  imports: [DatePipe, RouterLink, IconComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <a class="eyebrow" routerLink="/suscripcion">Suscripción</a>
          <h1>Planes</h1>
        </div>
      </div>
      <p class="lead">
        Todos los planes tienen las mismas funciones. Solo cambia cuántas obras activas puedes tener a la vez.
      </p>

      @if (current(); as s) {
        <p class="alert" [class]="s.readOnly ? 'alert alert-error' : 'alert alert-info'" data-testid="current-plan">
          @if (s.readOnly) {
            La suscripción venció y la cuenta está en solo lectura. Paga un plan para volver a registrar cambios.
          } @else if (s.status === 'TRIAL') {
            Estás en la prueba gratuita: {{ daysLeft() }}, hasta el {{ s.validUntil | date: 'dd/MM/yyyy' }}.
          } @else {
            Tienes el plan {{ s.planName }} en modalidad {{ (s.billingPeriodLabel ?? '').toLowerCase() }}, vigente hasta el
            {{ s.validUntil | date: 'dd/MM/yyyy' }}.
          }
        </p>
      }
      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }

      <fieldset class="period">
        <legend>Modalidad de pago</legend>
        <div class="segmented">
          @for (option of periods; track option) {
            <label>
              <input
                type="radio"
                name="period"
                [value]="option"
                [checked]="period() === option"
                (change)="period.set(option)"
              />
              {{ periodLabel(option) }}
            </label>
          }
        </div>
        @if (period() === 'ANNUAL' && maxDiscount() > 0) {
          <span class="hint">Ahorra hasta {{ percent(maxDiscount()) }} frente a doce pagos mensuales.</span>
        }
      </fieldset>

      @if (loading()) {
        <p class="loading">Cargando planes…</p>
      } @else {
        <fieldset>
          <legend class="visually-hidden">Plan</legend>
          <div class="plan-grid">
            @for (p of payablePlans(); track p.code) {
              <label class="plan" [class.selected]="selected() === p.code" [attr.data-plan]="p.code">
                <input
                  type="radio"
                  name="plan"
                  [value]="p.code"
                  [checked]="selected() === p.code"
                  (change)="selected.set(p.code)"
                />
                <span class="plan-name">{{ p.name }}</span>
                <span class="plan-desc">{{ p.description }}</span>
                @if (period() === 'MONTHLY') {
                  <span class="price">{{ money(p.monthlyPrice, p.currency) }} <small>al mes</small></span>
                  <span class="muted">{{ money(p.monthlyPrice * 12, p.currency) }} en doce meses</span>
                } @else {
                  <span class="price">{{ money(p.annualPrice, p.currency) }} <small>al año</small></span>
                  <span class="saving" data-testid="annual-saving">
                    Ahorras {{ money(p.annualSavings, p.currency) }} ({{ percent(p.annualDiscountPercent) }})
                  </span>
                  <span class="muted">Equivale a {{ money(p.annualPrice / 12, p.currency) }} al mes</span>
                }
                <span class="limit">
                  <app-icon name="worksites" />
                  {{ p.maxActiveWorksites === null ? 'Obras activas ilimitadas' : 'Hasta ' + p.maxActiveWorksites + ' obras activas' }}
                </span>
              </label>
            }
          </div>
        </fieldset>

        <div class="card summary">
          @if (selectedPlan(); as p) {
            <p>
              Primer cobro: <strong data-testid="first-charge">{{ money(amount(p), p.currency) }}</strong>
              por el plan {{ p.name }} en modalidad {{ periodLabel(period()).toLowerCase() }}.
            </p>
          }
          <p class="muted">
            El pago se hace en Stripe, la pasarela de pagos. BuildShield nunca recibe ni guarda los datos de tu tarjeta.
            La suscripción se activa en cuanto la pasarela confirma el pago.
          </p>
          @if (alreadyPaid()) {
            <p class="alert alert-warning">
              Ya tienes un plan pagado vigente. El cambio de plan con un plan vigente todavía no está disponible:
              podrás elegir otro plan al terminar el periodo.
            </p>
          }
          <button
            class="btn btn-primary"
            type="button"
            [disabled]="paying() || !selectedPlan() || alreadyPaid()"
            (click)="pay()"
            data-testid="pay"
          >
            <app-icon name="card" />
            {{ paying() ? 'Abriendo el pago…' : 'Ir a pagar' }}
          </button>
        </div>
      }
    </section>
  `,
  styles: `
    .period {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 16px;
      margin-bottom: 20px;
      legend {
        font-weight: 600;
        margin-bottom: 8px;
      }
      .hint {
        color: var(--bs-conforme);
        font-weight: 600;
      }
    }
    .plan-grid {
      display: grid;
      gap: var(--bs-gap);
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      margin-bottom: var(--bs-gap);
    }
    .plan {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 20px;
      background: var(--bs-losa);
      border: 1.5px solid var(--bs-junta);
      border-radius: var(--bs-radius);
      cursor: pointer;
      input {
        position: absolute;
        top: 20px;
        right: 20px;
        width: 22px;
        height: 22px;
        accent-color: var(--bs-asfalto);
      }
      &.selected {
        border-color: var(--bs-asfalto);
        box-shadow: inset 4px 0 0 var(--bs-senal);
      }
      &:has(input:focus-visible) {
        box-shadow: var(--bs-ring);
      }
    }
    .plan-name {
      font-family: var(--bs-font-display);
      font-size: 1.75rem;
      font-weight: 800;
    }
    .plan-desc {
      color: var(--bs-acero);
    }
    .price {
      font-family: var(--bs-font-display);
      font-size: 2.25rem;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      small {
        font-family: var(--bs-font);
        font-size: 1rem;
        font-weight: 500;
        color: var(--bs-acero);
      }
    }
    .saving {
      color: var(--bs-conforme);
      font-weight: 600;
    }
    .limit {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
      padding-top: 12px;
      border-top: 1px solid var(--bs-junta-suave);
      font-weight: 600;
    }
  `,
})
export class PlansPageComponent implements OnInit {
  private readonly plansService = inject(PublicPlansService);
  private readonly api = inject(SubscriptionApiService);
  private readonly state = inject(SubscriptionStateService);
  private readonly router = inject(Router);
  private readonly location = inject(BrowserLocation);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly periods: readonly BillingPeriod[] = ['MONTHLY', 'ANNUAL'];
  protected readonly plans = signal<readonly PublicPlan[]>([]);
  protected readonly loading = signal(true);
  protected readonly paying = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly period = signal<BillingPeriod>('ANNUAL');
  protected readonly selected = signal<PlanCode>('PLUS');
  protected readonly current = signal<Subscription | null>(null);

  protected readonly payablePlans = computed(() => this.plans().filter((p) => !p.trialOnly));
  protected readonly selectedPlan = computed(
    () => this.payablePlans().find((p) => p.code === this.selected()) ?? null,
  );
  protected readonly maxDiscount = computed(() =>
    Math.max(0, ...this.payablePlans().map((p) => p.annualDiscountPercent)),
  );
  protected readonly daysLeft = computed(() => daysLeftLabel(this.current()?.daysRemaining ?? 0).toLowerCase());
  protected readonly alreadyPaid = computed(() => {
    const s = this.current();
    return s !== null && s.status === 'ACTIVE' && !s.readOnly;
  });

  ngOnInit(): void {
    this.plansService
      .catalog()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((catalog) => {
        this.plans.set(catalog.plans);
        this.loading.set(false);
      });
    this.api
      .current()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sub) => {
          this.current.set(sub);
          this.state.set(sub);
          if (sub.plan === 'PRO') {
            this.selected.set('PRO');
          }
        },
        // Sin suscripción visible igual se puede elegir un plan.
        error: () => undefined,
      });
  }

  protected periodLabel(period: BillingPeriod): string {
    return BILLING_PERIOD_LABELS[period];
  }

  protected money(amount: number, currency: string): string {
    return formatMoney(amount, currency);
  }

  protected percent(value: number): string {
    return formatPercent(value);
  }

  protected amount(plan: PublicPlan): number {
    return this.period() === 'ANNUAL' ? plan.annualPrice : plan.monthlyPrice;
  }

  /** Crea la sesión de pago y lleva al administrador a Stripe Checkout (o al pago simulado). */
  protected pay(): void {
    const plan = this.selectedPlan();
    if (!plan) {
      return;
    }
    this.paying.set(true);
    this.error.set(null);
    this.api.checkout(plan.code, this.period()).subscribe({
      next: (session) => {
        const url = session.checkoutUrl;
        const origin = this.location.origin;
        if (url.startsWith(origin + '/') || url.startsWith('/')) {
          // Pago simulado: es una página de esta misma aplicación.
          void this.router.navigateByUrl(url.startsWith('/') ? url : url.slice(origin.length));
        } else {
          this.location.assign(url);
        }
      },
      error: (err: unknown) => {
        this.paying.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }
}
