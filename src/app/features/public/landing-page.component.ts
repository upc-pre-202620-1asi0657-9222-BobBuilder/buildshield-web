import {ChangeDetectionStrategy, Component, OnInit, computed, inject} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {Meta} from '@angular/platform-browser';
import {RouterLink} from '@angular/router';

import {PublicPlansService} from '../../core/api/public-plans.service';
import {PlanCatalog, PublicPlan} from '../../core/models/plan';
import {
  TEAM,
  TEAM_CAREER,
  formatMoney,
  formatPercent,
  fullNameOf,
  initialsOf,
} from './public-content';
import {PublicFooterComponent} from './public-footer.component';
import {PublicHeaderComponent} from './public-header.component';

/** El título lo pone la ruta (app.routes.ts); la descripción, el componente. */
export const LANDING_DESCRIPTION =
  'BuildShield concilia cada despacho de materiales contra lo recibido en obra, calcula la merma ' +
  'y la evalúa contra la tolerancia. Prueba gratuita con todas las funciones.';

/** Vista de un plan con los textos ya formateados. */
interface PlanView {
  readonly plan: PublicPlan;
  readonly worksites: string;
  readonly monthly: string;
  readonly annual: string;
  readonly savings: string | null;
  readonly cta: string;
}

/**
 * T82 y T83 (US49): página pública con el problema, la solución, los planes con
 * su precio mensual y anual, el acceso a la prueba gratuita y el equipo.
 */
@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink, PublicHeaderComponent, PublicFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss',
})
export class LandingPageComponent implements OnInit {
  private readonly meta = inject(Meta);

  protected readonly catalog = toSignal<PlanCatalog | null>(inject(PublicPlansService).catalog(), {
    initialValue: null,
  });

  protected readonly plans = computed<readonly PlanView[]>(() =>
    (this.catalog()?.plans ?? []).map((plan) => this.toView(plan)),
  );

  protected readonly trialDays = computed(
    () => this.catalog()?.plans.find((plan) => plan.trialOnly)?.trialDays ?? 14,
  );

  protected readonly team = TEAM.map((member) => ({
    name: fullNameOf(member),
    initials: initialsOf(member),
  }));
  protected readonly career = TEAM_CAREER;

  ngOnInit(): void {
    this.meta.updateTag({name: 'description', content: LANDING_DESCRIPTION});
  }

  private toView(plan: PublicPlan): PlanView {
    if (plan.trialOnly) {
      return {
        plan,
        worksites: 'Obras activas sin límite durante la prueba',
        monthly: formatMoney(0, plan.currency),
        annual: `${plan.trialDays ?? 14} días de prueba gratuita`,
        savings: null,
        cta: 'Empezar prueba gratuita',
      };
    }
    return {
      plan,
      worksites:
        plan.maxActiveWorksites === null
          ? 'Obras activas ilimitadas'
          : `Hasta ${plan.maxActiveWorksites} obras activas`,
      monthly: formatMoney(plan.monthlyPrice, plan.currency),
      annual: `o ${formatMoney(plan.annualPrice, plan.currency)} al año`,
      savings:
        plan.annualSavings > 0
          ? `Ahorras ${formatMoney(plan.annualSavings, plan.currency)} al año ` +
            `(${formatPercent(plan.annualDiscountPercent)}) frente al pago mensual`
          : null,
      cta: `Probar y luego elegir ${plan.name}`,
    };
  }
}
