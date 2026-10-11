import {ChangeDetectionStrategy, Component, OnInit, inject} from '@angular/core';
import {Meta} from '@angular/platform-browser';
import {RouterLink} from '@angular/router';

import {FALLBACK_PLANS} from '../../core/api/public-plans.service';
import {LEGAL_CONTACT_EMAIL, LEGAL_UPDATED_AT, formatMoney} from './public-content';
import {PublicFooterComponent} from './public-footer.component';
import {PublicHeaderComponent} from './public-header.component';

export const TERMS_DESCRIPTION =
  'Términos del servicio de BuildShield: cuentas y roles, prueba gratuita, planes por obras ' +
  'activas, pagos con Stripe y solo lectura al vencer la suscripción.';

const TERMS_SECTIONS = [
  {id: 'objeto', title: 'Objeto y aceptación'},
  {id: 'servicio', title: 'El servicio'},
  {id: 'cuentas', title: 'Organización, cuentas y roles'},
  {id: 'prueba-planes', title: 'Prueba gratuita y planes'},
  {id: 'pagos', title: 'Pagos'},
  {id: 'solo-lectura', title: 'Vencimiento y solo lectura'},
  {id: 'uso', title: 'Uso aceptable'},
  {id: 'datos', title: 'Datos de la organización'},
  {id: 'disponibilidad', title: 'Disponibilidad y responsabilidad'},
  {id: 'cambios', title: 'Cambios en los términos'},
  {id: 'ley', title: 'Ley aplicable'},
  {id: 'contacto', title: 'Contacto'},
] as const;

/** T84 (US50): términos del servicio. */
@Component({
  selector: 'app-terms-page',
  standalone: true,
  imports: [RouterLink, PublicHeaderComponent, PublicFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-public-header />
    <main id="contenido" tabindex="-1">
      <article class="legal" aria-labelledby="terms-title">
        <header class="legal-head">
          <h1 id="terms-title">Términos del servicio</h1>
          <p>
            Estas condiciones regulan el uso de BuildShield, la plataforma web de trazabilidad de
            materiales entre almacén y obra que ofrece BobBuilder.
          </p>
          <p class="updated">Última actualización: {{ updatedAt }}</p>
        </header>

        <nav class="toc" aria-labelledby="terms-toc">
          <h2 id="terms-toc">Contenido</h2>
          <ol>
            @for (section of sections; track section.id) {
              <li><a [routerLink]="[]" [fragment]="section.id">{{ section.title }}</a></li>
            }
          </ol>
        </nav>

        <div class="legal-body">
          <section id="objeto">
            <h2>1. Objeto y aceptación</h2>
            <p>
              Al registrar una organización o usar una cuenta de BuildShield, la organización y cada
              usuario aceptan estos términos y la
              <a routerLink="/privacidad">Política de privacidad</a>. Si no está de acuerdo, no use el
              servicio.
            </p>
          </section>

          <section id="servicio">
            <h2>2. El servicio</h2>
            <p>
              BuildShield es un servicio en línea por suscripción para empresas. Permite registrar
              pedidos de obra, despachos de materiales identificados por SKU, pesajes de salida y de
              llegada, la recepción en obra y la conciliación de lo despachado contra lo recibido.
              Con esa conciliación calcula la merma de cada material, la evalúa contra la tolerancia
              definida por la organización y abre discrepancias cuando corresponde. Mantiene el
              historial de custodia y un registro de auditoría.
            </p>
            <p>
              El servicio funciona con conexión a internet desde un navegador. No incluye
              seguimiento por GPS ni geolocalización en tiempo real, ni operación sin conexión.
            </p>
          </section>

          <section id="cuentas">
            <h2>3. Organización, cuentas y roles</h2>
            <ul>
              <li>
                Quien registra la organización declara tener facultades para obligarla y queda como
                su primer administrador.
              </li>
              <li>
                Hay tres roles: administrador, encargado de almacén y encargado de obra. El
                administrador crea los usuarios, les asigna su rol y responde por los accesos que
                concede.
              </li>
              <li>
                Cada usuario es responsable de mantener en reserva su contraseña y de lo que se
                registre con su cuenta. Si sospecha un acceso indebido, debe avisar al administrador
                y cambiar su contraseña.
              </li>
              <li>Los datos de registro deben ser verdaderos y mantenerse actualizados.</li>
            </ul>
          </section>

          <section id="prueba-planes">
            <h2>4. Prueba gratuita y planes</h2>
            <p>
              Cada organización nueva empieza con una prueba gratuita de {{ trialDays }} días con
              todas las funciones. Después puede contratar uno de estos planes, que tienen las mismas
              funciones y se diferencian por el número de obras activas:
            </p>
            <ul>
              <li><strong>Free</strong>: solo la prueba gratuita.</li>
              <li><strong>Plus</strong>: hasta 5 obras activas.</li>
              <li><strong>Pro</strong>: obras activas ilimitadas.</li>
            </ul>
            <p>
              Los planes se pagan por mes o por año; el pago anual tiene descuento frente a doce
              pagos mensuales. A la fecha, Plus cuesta {{ plus.monthly }} al mes o {{ plus.annual }}
              al año y Pro cuesta {{ pro.monthly }} al mes o {{ pro.annual }} al año. Los precios
              vigentes son los que se muestran al momento de contratar. Un cambio de precio no afecta
              el período ya pagado.
            </p>
          </section>

          <section id="pagos">
            <h2>5. Pagos</h2>
            <p>
              Los pagos se procesan a través de Stripe, una pasarela de pagos externa. Los datos de
              la tarjeta se ingresan directamente en Stripe: BuildShield no los recibe ni los
              guarda. BuildShield solo conserva el estado de la suscripción, el plan, el período y
              los comprobantes de pago.
            </p>
            <p>
              La suscripción se renueva al final de cada período mensual o anual, salvo que el
              administrador la cancele antes. La cancelación surte efecto al terminar el período
              pagado.
            </p>
          </section>

          <section id="solo-lectura">
            <h2>6. Vencimiento y solo lectura</h2>
            <p>
              Cuando termina la prueba gratuita sin que se contrate un plan, o cuando una
              suscripción vence sin pago, la cuenta de la organización pasa a solo lectura. En ese
              estado los usuarios pueden iniciar sesión y consultar lo registrado, pero no pueden
              registrar pedidos, despachos, recepciones ni otros cambios. La cuenta vuelve a su uso
              normal en cuanto se paga un plan.
            </p>
          </section>

          <section id="uso">
            <h2>7. Uso aceptable</h2>
            <p>No está permitido:</p>
            <ul>
              <li>registrar información falsa o de terceros sin autorización;</li>
              <li>intentar acceder a datos de otra organización o eludir los controles de acceso;</li>
              <li>afectar el funcionamiento del servicio o someterlo a cargas abusivas;</li>
              <li>usar el servicio para fines ilícitos.</li>
            </ul>
            <p>
              BobBuilder puede suspender una cuenta que incumpla estas reglas, informando el motivo
              al administrador.
            </p>
          </section>

          <section id="datos">
            <h2>8. Datos de la organización</h2>
            <p>
              La información que la organización registra en BuildShield le pertenece. BobBuilder la
              trata solo para prestar el servicio, según la
              <a routerLink="/privacidad">Política de privacidad</a> y la Ley N.º 29733, Ley de
              Protección de Datos Personales. Cada organización solo ve su propia información.
            </p>
          </section>

          <section id="disponibilidad">
            <h2>9. Disponibilidad y responsabilidad</h2>
            <p>
              BobBuilder procura que el servicio esté disponible de forma continua, pero puede
              haber interrupciones por mantenimiento o por causas ajenas a su control. BuildShield
              es una herramienta de registro y control: las decisiones sobre los materiales, los
              proveedores y el personal corresponden a la organización. En la medida que la ley lo
              permita, la responsabilidad de BobBuilder se limita al monto pagado por la organización
              en los doce meses anteriores al hecho que la origine.
            </p>
          </section>

          <section id="cambios">
            <h2>10. Cambios en los términos</h2>
            <p>
              Si estos términos cambian, se publicará la nueva versión en esta página con su fecha y
              se avisará a los administradores con anticipación razonable. Seguir usando el servicio
              después de esa fecha implica aceptar la nueva versión.
            </p>
          </section>

          <section id="ley">
            <h2>11. Ley aplicable</h2>
            <p>
              Estos términos se rigen por las leyes de la República del Perú. Cualquier controversia
              se somete a los jueces y tribunales de Lima.
            </p>
          </section>

          <section id="contacto">
            <h2>12. Contacto</h2>
            <p class="legal-foot">
              Para consultas sobre estos términos escriba a
              <a [href]="'mailto:' + contactEmail">{{ contactEmail }}</a>.
            </p>
          </section>
        </div>
      </article>
    </main>
    <app-public-footer />
  `,
  styleUrl: './legal-page.scss',
})
export class TermsPageComponent implements OnInit {
  private readonly meta = inject(Meta);

  protected readonly sections = TERMS_SECTIONS;
  protected readonly updatedAt = LEGAL_UPDATED_AT;
  protected readonly contactEmail = LEGAL_CONTACT_EMAIL;
  protected readonly trialDays = FALLBACK_PLANS[0].trialDays;
  protected readonly plus = this.prices('PLUS');
  protected readonly pro = this.prices('PRO');

  ngOnInit(): void {
    this.meta.updateTag({name: 'description', content: TERMS_DESCRIPTION});
  }

  private prices(code: 'PLUS' | 'PRO'): {monthly: string; annual: string} {
    const plan = FALLBACK_PLANS.find((candidate) => candidate.code === code)!;
    return {
      monthly: formatMoney(plan.monthlyPrice, plan.currency),
      annual: formatMoney(plan.annualPrice, plan.currency),
    };
  }
}
