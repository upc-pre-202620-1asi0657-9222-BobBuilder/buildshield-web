import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed, fakeAsync, tick} from '@angular/core/testing';

import {TEST_ENV} from '../../../testing/test-helpers';
import {APP_ENV} from '../config/app-env';
import {SKIP_AUTH, SKIP_RETRY} from '../http/http-context';
import {PlanCatalog, PlanResponse} from '../models/plan';
import {FALLBACK_PLANS, PUBLIC_PLANS_TIMEOUT_MS, PublicPlansService} from './public-plans.service';

const API_PLANS: PlanResponse[] = [
  {
    code: 'PRO',
    name: 'Pro',
    maxActiveWorksites: null,
    unlimitedWorksites: true,
    trialOnly: false,
    monthlyPrice: 650,
    annualPrice: '6500.00',
    currency: 'PEN',
  },
  {
    code: 'FREE',
    name: 'Free',
    unlimitedWorksites: true,
    trialOnly: true,
    trialDays: 21,
    monthlyPrice: 0,
    annualPrice: 0,
    currency: 'PEN',
  },
  {
    code: 'PLUS',
    name: 'Plus',
    maxActiveWorksites: 5,
    unlimitedWorksites: false,
    trialOnly: false,
    monthlyPrice: 299,
    annualPrice: 2990,
    annualDiscountPercent: 16.67,
    annualSavings: 598,
    currency: 'PEN',
  },
];

describe('PublicPlansService (US49)', () => {
  let service: PublicPlansService;
  let http: HttpTestingController;
  let result: PlanCatalog | undefined;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {provide: APP_ENV, useValue: TEST_ENV},
      ],
    });
    service = TestBed.inject(PublicPlansService);
    http = TestBed.inject(HttpTestingController);
    result = undefined;
  });

  afterEach(() => http.verify());

  it('lee el catálogo público sin token ni reintentos y lo ordena Free, Plus, Pro', () => {
    service.catalog().subscribe((catalog) => (result = catalog));
    const req = http.expectOne('/api/v1/plans');
    expect(req.request.context.get(SKIP_AUTH)).toBeTrue();
    expect(req.request.context.get(SKIP_RETRY)).toBeTrue();
    req.flush(API_PLANS);

    expect(result?.source).toBe('api');
    expect(result?.plans.map((plan) => plan.code)).toEqual(['FREE', 'PLUS', 'PRO']);
    expect(result?.plans[0].trialDays).toBe(21);
    expect(result?.plans[1].maxActiveWorksites).toBe(5);
  });

  it('calcula el ahorro anual y el descuento cuando la API no los envía', () => {
    service.catalog().subscribe((catalog) => (result = catalog));
    http.expectOne('/api/v1/plans').flush(API_PLANS);

    const pro = result!.plans[2];
    expect(pro.annualPrice).toBe(6500);
    expect(pro.annualSavings).toBe(1300);
    expect(pro.annualDiscountPercent).toBe(16.67);
    expect(pro.maxActiveWorksites).toBeNull();
  });

  it('usa el respaldo estático si la llamada falla', () => {
    service.catalog().subscribe((catalog) => (result = catalog));
    http.expectOne('/api/v1/plans').flush({}, {status: 401, statusText: 'Unauthorized'});

    expect(result?.source).toBe('fallback');
    expect(result?.plans).toEqual(FALLBACK_PLANS);
  });

  it('usa el respaldo si falta el precio anual de un plan de pago', () => {
    service.catalog().subscribe((catalog) => (result = catalog));
    const incomplete = API_PLANS.map((plan) =>
      plan.code === 'PLUS' ? {...plan, annualPrice: null} : plan,
    );
    http.expectOne('/api/v1/plans').flush(incomplete);

    expect(result?.source).toBe('fallback');
  });

  it('usa el respaldo si falta un plan o la respuesta no es una lista', () => {
    service.catalog().subscribe((catalog) => (result = catalog));
    http.expectOne('/api/v1/plans').flush(API_PLANS.slice(0, 2));
    expect(result?.source).toBe('fallback');

    service.catalog().subscribe((catalog) => (result = catalog));
    http.expectOne('/api/v1/plans').flush({plans: API_PLANS});
    expect(result?.source).toBe('fallback');
  });

  it('usa el respaldo si la API tarda más del tiempo máximo', fakeAsync(() => {
    service.catalog().subscribe((catalog) => (result = catalog));
    const req = http.expectOne('/api/v1/plans');
    tick(PUBLIC_PLANS_TIMEOUT_MS + 1);

    expect(req.cancelled).toBeTrue();
    expect(result?.source).toBe('fallback');
  }));

  it('el respaldo tiene los supuestos vigentes de precios y ahorro', () => {
    const [free, plus, pro] = FALLBACK_PLANS;
    expect(free.trialDays).toBe(14);
    expect(plus.monthlyPrice * 12 - plus.annualPrice).toBe(plus.annualSavings);
    expect(pro.monthlyPrice * 12 - pro.annualPrice).toBe(pro.annualSavings);
    expect(plus.annualPrice).toBe(2990);
    expect(pro.annualPrice).toBe(6990);
  });
});
