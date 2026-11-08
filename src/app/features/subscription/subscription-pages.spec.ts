import {registerLocaleData} from '@angular/common';
import {HttpErrorResponse} from '@angular/common/http';
import localeEsPe from '@angular/common/locales/es-PE';
import {LOCALE_ID} from '@angular/core';
import {TestBed, fakeAsync, tick} from '@angular/core/testing';
import {ActivatedRoute, Router, convertToParamMap, provideRouter} from '@angular/router';
import {of, throwError} from 'rxjs';

import {fakeSubscription} from '../../../testing/test-helpers';
import {FALLBACK_PLANS, PublicPlansService} from '../../core/api/public-plans.service';
import {SubscriptionApiService} from '../../core/api/subscription-api.service';
import {toApiError} from '../../core/http/api-error';
import {CheckoutSession} from '../../core/models/subscription';
import {SubscriptionStateService} from '../../core/subscription/subscription-state.service';
import {BrowserLocation} from '../../core/util/browser-location';
import {PlansPageComponent} from './plans-page.component';
import {SimulatedPaymentPageComponent} from './simulated-payment-page.component';
import {SUBSCRIPTION_WAIT_MS, SubscriptionPageComponent} from './subscription-page.component';

function apiError(status: number, code: string) {
  return throwError(() => toApiError(new HttpErrorResponse({status, error: {code}})));
}

function session(overrides: Partial<CheckoutSession> = {}): CheckoutSession {
  return {
    sessionId: 'cs_sim_1',
    checkoutUrl: 'http://localhost:4200/suscripcion/pago-simulado?session_id=cs_sim_1&plan=PLUS&billingPeriod=ANNUAL',
    plan: 'PLUS',
    billingPeriod: 'ANNUAL',
    amount: 2990,
    currency: 'PEN',
    provider: 'SIMULATED',
    simulated: true,
    reused: false,
    status: 'OPEN',
    ...overrides,
  };
}

registerLocaleData(localeEsPe);

describe('Suscripción (US05, US07, US08, US11 y US12)', () => {
  let api: jasmine.SpyObj<SubscriptionApiService>;
  let location: jasmine.SpyObj<BrowserLocation>;
  let router: Router;

  function setup(query: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {provide: LOCALE_ID, useValue: 'es-PE'},
        {provide: SubscriptionApiService, useValue: api},
        {provide: PublicPlansService, useValue: {catalog: () => of({plans: FALLBACK_PLANS, source: 'api'})}},
        {provide: BrowserLocation, useValue: location},
        {provide: ActivatedRoute, useValue: {snapshot: {queryParamMap: convertToParamMap(query)}}},
      ],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    spyOn(router, 'navigate').and.resolveTo(true);
  }

  beforeEach(() => {
    api = jasmine.createSpyObj<SubscriptionApiService>('SubscriptionApiService', [
      'current',
      'checkout',
      'confirmSimulatedPayment',
      'changeBillingPeriod',
    ]);
    location = jasmine.createSpyObj<BrowserLocation>('BrowserLocation', ['assign'], {origin: 'http://localhost:4200'});
  });

  describe('SubscriptionPageComponent', () => {
    it('da la bienvenida con el inicio de la prueba y los días que quedan (T69)', () => {
      api.current.and.returnValue(of(fakeSubscription({daysRemaining: 14})));
      setup({bienvenida: '1'});
      const fixture = TestBed.createComponent(SubscriptionPageComponent);
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('[data-testid="trial-welcome"]')).not.toBeNull();
      expect(element.querySelector('[data-testid="trial-days"]')?.textContent).toContain('quedan 14 días');
      expect(element.textContent).toContain('11 de octubre de 2026');
      expect(TestBed.inject(SubscriptionStateService).subscription()?.daysRemaining).toBe(14);
    });

    it('espera a que la suscripción exista después del registro', fakeAsync(() => {
      api.current.and.returnValues(apiError(404, 'SUBSCRIPTION_NOT_FOUND'), of(fakeSubscription()));
      setup({bienvenida: '1'});
      const fixture = TestBed.createComponent(SubscriptionPageComponent);
      fixture.detectChanges();
      tick(SUBSCRIPTION_WAIT_MS);
      fixture.detectChanges();
      expect(api.current).toHaveBeenCalledTimes(2);
      expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="trial-welcome"]')).not.toBeNull();
    }));

    it('muestra plan, modalidad, próxima fecha de cobro y programa el cambio a anual (US11 y US12)', () => {
      const active = fakeSubscription({
        plan: 'PLUS',
        planName: 'Plus',
        status: 'ACTIVE',
        statusLabel: 'Activa',
        billingPeriod: 'MONTHLY',
        billingPeriodLabel: 'Mensual',
        nextBillingAt: '2026-11-11T15:00:00Z',
        paymentProvider: 'SIMULATED',
      });
      api.current.and.returnValue(of(active));
      api.changeBillingPeriod.and.returnValue(
        of({
          outcome: 'SCHEDULED',
          subscription: {...active, pendingBillingPeriod: 'ANNUAL', pendingChangeAt: '2026-11-11T15:00:00Z'},
        }),
      );
      setup();
      const fixture = TestBed.createComponent(SubscriptionPageComponent);
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('[data-testid="next-billing"]')?.textContent).toContain('11/11/2026');
      expect(element.textContent).toContain('ahorras S/');

      (element.querySelector('[data-testid="change-period"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(api.changeBillingPeriod).toHaveBeenCalledWith('ANNUAL');
      expect(element.querySelector('[data-testid="pending-change"]')?.textContent).toContain('anual');
      expect(element.textContent).toContain('Cambio programado');
    });

    it('al volver del pago espera la activación y lo confirma', fakeAsync(() => {
      api.current.and.returnValues(
        of(fakeSubscription({status: 'EXPIRED', readOnly: true})),
        of(fakeSubscription({status: 'ACTIVE', plan: 'PLUS', planName: 'Plus', billingPeriod: 'ANNUAL'})),
      );
      setup({pago: 'exitoso'});
      const fixture = TestBed.createComponent(SubscriptionPageComponent);
      fixture.detectChanges();
      tick(SUBSCRIPTION_WAIT_MS);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="payment-ok"]')).not.toBeNull();
      expect(TestBed.inject(SubscriptionStateService).readOnly()).toBeFalse();
    }));
  });

  describe('PlansPageComponent', () => {
    it('muestra Plus y Pro con el ahorro anual y paga yendo al checkout simulado (T71 y T72)', () => {
      api.current.and.returnValue(of(fakeSubscription({daysRemaining: 2})));
      api.checkout.and.returnValue(of(session()));
      setup();
      const fixture = TestBed.createComponent(PlansPageComponent);
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelectorAll('[data-plan]').length).toBe(2);
      expect(element.querySelector('[data-plan="FREE"]')).toBeNull();
      expect(element.querySelector('[data-plan="PLUS"] [data-testid="annual-saving"]')?.textContent).toContain('598');
      expect(element.querySelector('[data-testid="first-charge"]')?.textContent).toContain('2 990');

      (element.querySelector('[data-testid="pay"]') as HTMLButtonElement).click();
      expect(api.checkout).toHaveBeenCalledWith('PLUS', 'ANNUAL');
      expect(router.navigateByUrl).toHaveBeenCalledWith(
        '/suscripcion/pago-simulado?session_id=cs_sim_1&plan=PLUS&billingPeriod=ANNUAL',
      );
      expect(location.assign).not.toHaveBeenCalled();
    });

    it('redirige fuera de la aplicación cuando el checkout es de Stripe', () => {
      api.current.and.returnValue(of(fakeSubscription()));
      api.checkout.and.returnValue(of(session({checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_1', simulated: false})));
      setup();
      const fixture = TestBed.createComponent(PlansPageComponent);
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      (element.querySelector('[data-plan="PRO"] input') as HTMLInputElement).click();
      (element.querySelector('input[value="MONTHLY"]') as HTMLInputElement).click();
      fixture.detectChanges();
      expect(element.querySelector('[data-testid="first-charge"]')?.textContent).toContain('699');
      (element.querySelector('[data-testid="pay"]') as HTMLButtonElement).click();
      expect(api.checkout).toHaveBeenCalledWith('PRO', 'MONTHLY');
      expect(location.assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_1');
    });

    it('explica el error de la pasarela y no deja pagar con un plan vigente', () => {
      api.current.and.returnValue(of(fakeSubscription({status: 'ACTIVE', plan: 'PLUS', planName: 'Plus'})));
      setup();
      const fixture = TestBed.createComponent(PlansPageComponent);
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      expect((element.querySelector('[data-testid="pay"]') as HTMLButtonElement).disabled).toBeTrue();
      expect(element.textContent).toContain('Ya tienes un plan pagado vigente');
    });

    it('muestra el 503 de la pasarela', () => {
      api.current.and.returnValue(of(fakeSubscription()));
      api.checkout.and.returnValue(apiError(503, 'PAYMENT_GATEWAY_UNAVAILABLE'));
      setup();
      const fixture = TestBed.createComponent(PlansPageComponent);
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('[data-testid="pay"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('La pasarela de pagos no responde');
    });
  });

  describe('SimulatedPaymentPageComponent', () => {
    it('deja claro que es una demostración y confirma el pago simulado', () => {
      api.confirmSimulatedPayment.and.returnValue(of(fakeSubscription({status: 'ACTIVE', plan: 'PLUS'})));
      setup({session_id: 'cs_sim_1', plan: 'PLUS', billingPeriod: 'ANNUAL'});
      const fixture = TestBed.createComponent(SimulatedPaymentPageComponent);
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('[data-testid="demo-notice"]')?.textContent).toContain('demostración');
      expect(element.querySelector('[data-testid="sim-plan"]')?.textContent).toContain('Plus');
      expect(element.textContent).toContain('2 990');

      (element.querySelector('[data-testid="confirm-simulated"]') as HTMLButtonElement).click();
      expect(api.confirmSimulatedPayment).toHaveBeenCalledWith('cs_sim_1');
      expect(router.navigate).toHaveBeenCalledWith(['/suscripcion'], {queryParams: {pago: 'exitoso'}});
      expect(TestBed.inject(SubscriptionStateService).subscription()?.status).toBe('ACTIVE');
    });

    it('sin sesión de pago invita a volver a los planes', () => {
      setup();
      const fixture = TestBed.createComponent(SimulatedPaymentPageComponent);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Falta la sesión de pago');
      expect(fixture.nativeElement.querySelector('[data-testid="confirm-simulated"]')).toBeNull();
    });
  });
});
