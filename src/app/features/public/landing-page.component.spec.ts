import {TestBed} from '@angular/core/testing';
import {Meta} from '@angular/platform-browser';
import {provideRouter} from '@angular/router';
import {Observable, Subject, of} from 'rxjs';

import {FALLBACK_PLANS, PublicPlansService} from '../../core/api/public-plans.service';
import {PlanCatalog, PublicPlan} from '../../core/models/plan';
import {LANDING_DESCRIPTION, LandingPageComponent} from './landing-page.component';
import {TEAM, formatMoney as money, initialsOf} from './public-content';

/** Igual que en pantalla, pero con espacios normales para comparar con `text()`. */
const formatMoney = (amount: number) => money(amount).replace(/\u00a0/g, ' ');

function render(catalog$: Observable<PlanCatalog>) {
  TestBed.configureTestingModule({
    imports: [LandingPageComponent],
    providers: [provideRouter([]), {provide: PublicPlansService, useValue: {catalog: () => catalog$}}],
  });
  const fixture = TestBed.createComponent(LandingPageComponent);
  fixture.detectChanges();
  return {fixture, element: fixture.nativeElement as HTMLElement};
}

const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('LandingPageComponent (US49)', () => {
  it('tiene landmarks, un solo h1 y las secciones del problema, la solución, planes y nosotros', () => {
    const {element, fixture} = render(of({plans: FALLBACK_PLANS, source: 'fallback'}));

    expect(element.querySelector('header.pub-header')).not.toBeNull();
    expect(element.querySelector('main#contenido')).not.toBeNull();
    expect(element.querySelector('footer.pub-footer')).not.toBeNull();
    expect(element.querySelectorAll('h1').length).toBe(1);
    for (const id of ['problema', 'solucion', 'planes', 'nosotros']) {
      expect(element.querySelector(`section#${id} h2`)).withContext(id).not.toBeNull();
    }
    expect(text(element.querySelector('#problema'))).toContain('Recepción sin comparar');
    expect(text(element.querySelector('#solucion'))).toContain('evalúa contra la tolerancia');
    expect(text(element.querySelector('#solucion'))).toContain('Discrepancias');
    expect(text(element.querySelector('#solucion'))).toContain('Trazabilidad y auditoría');
    fixture.destroy();
  });

  it('el recorrido del despacho es la única lista numerada: Preparado, En tránsito, Recibido', () => {
    const {element, fixture} = render(of({plans: FALLBACK_PLANS, source: 'fallback'}));

    const ordered = element.querySelectorAll('main ol');
    expect(ordered.length).toBe(1);
    const steps = Array.from(ordered[0].querySelectorAll('h3')).map((h) => text(h));
    expect(steps).toEqual(['Preparado', 'En tránsito', 'Recibido']);
    fixture.destroy();
  });

  it('muestra los planes con precio mensual, anual y ahorro anual del respaldo', () => {
    const {element, fixture} = render(of({plans: FALLBACK_PLANS, source: 'fallback'}));

    const list = element.querySelector('.plans');
    expect(list?.getAttribute('data-source')).toBe('fallback');
    const plus = element.querySelector('[data-plan="PLUS"]');
    expect(text(plus?.querySelector('.plan-price') ?? null)).toBe(`${formatMoney(299)} al mes`);
    expect(text(plus?.querySelector('.plan-annual') ?? null)).toBe(`o ${formatMoney(2990)} al año`);
    expect(text(plus?.querySelector('.plan-savings') ?? null)).toContain(`Ahorras ${formatMoney(598)} al año`);
    expect(text(plus)).toContain('Hasta 5 obras activas');

    const pro = element.querySelector('[data-plan="PRO"]');
    expect(text(pro?.querySelector('.plan-price') ?? null)).toContain(formatMoney(699));
    expect(text(pro?.querySelector('.plan-savings') ?? null)).toContain(formatMoney(1398));
    expect(text(pro)).toContain('Obras activas ilimitadas');

    const free = element.querySelector('[data-plan="FREE"]');
    expect(text(free)).toContain('14 días de prueba gratuita');
    expect(free?.querySelector('.plan-savings')).toBeNull();
    expect(text(element.querySelector('.plans-ref'))).toContain('Precios de referencia');
    fixture.destroy();
  });

  it('usa los precios de la API cuando llegan completos', () => {
    const plans: PublicPlan[] = FALLBACK_PLANS.map((plan) =>
      plan.code === 'PRO' ? {...plan, monthlyPrice: 750, annualPrice: 7500, annualSavings: 1500} : plan,
    );
    const {element, fixture} = render(of({plans, source: 'api'}));

    expect(element.querySelector('.plans')?.getAttribute('data-source')).toBe('api');
    expect(text(element.querySelector('[data-plan="PRO"] .plan-price'))).toContain(formatMoney(750));
    expect(element.querySelector('.plans-ref')).toBeNull();
    fixture.destroy();
  });

  it('muestra un estado de carga mientras llegan los planes', () => {
    const pending = new Subject<PlanCatalog>();
    const {element, fixture} = render(pending);

    expect(element.querySelector('#planes [role="status"]')).not.toBeNull();
    pending.next({plans: FALLBACK_PLANS, source: 'fallback'});
    fixture.detectChanges();
    expect(element.querySelectorAll('.plan').length).toBe(3);
    fixture.destroy();
  });

  it('lleva la prueba gratuita al registro de organización existente', () => {
    const {element, fixture} = render(of({plans: FALLBACK_PLANS, source: 'fallback'}));

    const trial = element.querySelector('[data-cta="trial"]');
    expect(trial?.getAttribute('href')).toBe('/sign-up');
    expect(element.querySelector('[data-cta="plan-FREE"]')?.getAttribute('href')).toBe('/sign-up');
    expect(element.querySelector('.pub-header a[href="/sign-in"]')).not.toBeNull();
    fixture.destroy();
  });

  it('aclara la solo lectura al vencer y que Stripe procesa los pagos sin guardar la tarjeta', () => {
    const {element, fixture} = render(of({plans: FALLBACK_PLANS, source: 'fallback'}));

    const notes = text(element.querySelector('.plan-notes'));
    expect(notes).toContain('solo lectura');
    expect(notes).toContain('Stripe');
    expect(notes).toContain('no recibe ni guarda los datos de tu tarjeta');
    fixture.destroy();
  });

  it('presenta a BobBuilder y a sus seis integrantes con iniciales, sin fotos', () => {
    const {element, fixture} = render(of({plans: FALLBACK_PLANS, source: 'fallback'}));

    const members = element.querySelectorAll('#nosotros .member');
    expect(members.length).toBe(6);
    expect(text(members[3].querySelector('.member-name'))).toBe('Fabian Jesus Sandoval Cueto');
    expect(text(members[3].querySelector('.avatar'))).toBe('FS');
    expect(text(members[0])).toContain('Ingeniería de Software, UPC');
    expect(element.querySelector('#nosotros img')).toBeNull();
    expect(TEAM.map(initialsOf)).toEqual(['BB', 'NR', 'AS', 'FS', 'AS', 'JT']);
    fixture.destroy();
  });

  it('enlaza los términos y la privacidad desde el pie y pone la meta descripción', () => {
    const {element, fixture} = render(of({plans: FALLBACK_PLANS, source: 'fallback'}));

    const footer = element.querySelector('footer');
    expect(footer?.querySelector('a[href="/terminos"]')).not.toBeNull();
    expect(footer?.querySelector('a[href="/privacidad"]')).not.toBeNull();
    expect(TestBed.inject(Meta).getTag('name="description"')?.content).toBe(LANDING_DESCRIPTION);
    fixture.destroy();
  });

  it('no usa rayas como puntuación en el texto visible', () => {
    const {element, fixture} = render(of({plans: FALLBACK_PLANS, source: 'fallback'}));

    expect(element.textContent).not.toMatch(/[—–]/);
    fixture.destroy();
  });
});

describe('formatMoney', () => {
  it('separa miles con espacio no separable y omite céntimos en cero', () => {
    expect(money(2990)).toBe('S/\u00a02\u00a0990');
    expect(money(299)).toBe('S/\u00a0299');
    expect(money(1398.5)).toBe('S/\u00a01\u00a0398,50');
  });
});
