import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Router, provideRouter} from '@angular/router';
import {of, throwError} from 'rxjs';

import {LogisticsApi} from '../../core/api/logistics-api';
import {ApiError} from '../../core/http/api-error';
import {ArrivalWeighing, Reception} from '../../core/models/logistics';
import {ArrivalWeighingComponent} from './arrival-weighing.component';
import {ReceptionPageComponent} from './reception-page.component';
import {ScanPageComponent, manifestCodeFrom} from './scan-page.component';

function reception(overrides: Partial<Reception> = {}): Reception {
  return {
    id: 'r1',
    dispatchId: 'd1',
    orderId: 'o1',
    warehouseId: 'a1',
    worksiteId: 'w1',
    status: 'IN_PROGRESS',
    confirmedBy: null,
    confirmedAt: null,
    lines: [
      {
        id: 'l1',
        dispatchLineId: 'dl1',
        orderLineId: 'ol1',
        materialId: 'm1',
        dispatchedQty: 100,
        receivedQty: 100,
        shrinkagePercent: 0,
      },
    ],
    arrivalWeighing: null,
    ...overrides,
  };
}

const weighing: ArrivalWeighing = {
  grossKg: 18000,
  tareKg: 8200,
  netKg: 9800,
  departureNetKg: 10250,
  differenceKg: 450,
  differencePercent: 4.39,
  tolerancePercent: 1,
  withinTolerance: false,
};

describe('manifestCodeFrom', () => {
  it('normaliza el código escrito o leído del QR', () => {
    expect(manifestCodeFrom('  man-20261008-abc ')).toBe('MAN-20261008-ABC');
    expect(manifestCodeFrom('https://app.buildshield.pe/m/MAN-1?x=1')).toBe('MAN-1');
    expect(manifestCodeFrom('')).toBe('');
  });
});

describe('ScanPageComponent (US34)', () => {
  let api: jasmine.SpyObj<LogisticsApi>;
  let fixture: ComponentFixture<ScanPageComponent>;
  let element: HTMLElement;
  let router: Router;

  beforeEach(() => {
    api = jasmine.createSpyObj<LogisticsApi>('LogisticsApi', ['openReceptionByManifest']);
    TestBed.configureTestingModule({
      imports: [ScanPageComponent],
      providers: [provideRouter([]), {provide: LogisticsApi, useValue: api}],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(ScanPageComponent);
    element = fixture.nativeElement as HTMLElement;
  });

  async function submit(code: string): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    const field = element.querySelector('#manifestCode') as HTMLInputElement;
    field.value = code;
    field.dispatchEvent(new Event('input'));
    (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('el campo del código siempre está visible', () => {
    fixture.detectChanges();
    expect(element.querySelector('#manifestCode')).not.toBeNull();
  });

  it('abre la recepción por código y lleva a /reception/{dispatchId}', async () => {
    api.openReceptionByManifest.and.returnValue(of(reception({dispatchId: 'd9'})));
    await submit('man-1');
    expect(api.openReceptionByManifest).toHaveBeenCalledWith('MAN-1');
    expect(router.navigate).toHaveBeenCalledWith(['/reception', 'd9']);
  });

  it('con 404 no revela si el código existe', async () => {
    api.openReceptionByManifest.and.returnValue(throwError(() => new ApiError(404, 'NOT_FOUND', 'x')));
    await submit('MAN-OTRA');
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('No encontramos un despacho');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('abre directo con ?code=', () => {
    api.openReceptionByManifest.and.returnValue(of(reception()));
    fixture.componentRef.setInput('code', 'MAN-QR');
    fixture.detectChanges();
    expect(api.openReceptionByManifest).toHaveBeenCalledWith('MAN-QR');
  });
});

describe('ArrivalWeighingComponent (US29)', () => {
  let api: jasmine.SpyObj<LogisticsApi>;
  let fixture: ComponentFixture<ArrivalWeighingComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    api = jasmine.createSpyObj<LogisticsApi>('LogisticsApi', ['registerArrivalWeighing']);
    TestBed.configureTestingModule({
      imports: [ArrivalWeighingComponent],
      providers: [{provide: LogisticsApi, useValue: api}],
    });
    fixture = TestBed.createComponent(ArrivalWeighingComponent);
    fixture.componentRef.setInput('receptionId', 'r1');
    element = fixture.nativeElement as HTMLElement;
  });

  function set(selector: string, value: string): void {
    const field = element.querySelector(selector) as HTMLInputElement;
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }

  it('rechaza un bruto que no supera la tara sin llamar al backend', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    set('#arrivalGross', '100');
    set('#arrivalTare', '200');
    (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(api.registerArrivalWeighing).not.toHaveBeenCalled();
    expect(element.textContent).toContain('mayor que la tara');
  });

  it('registra el pesaje y emite el resultado', async () => {
    api.registerArrivalWeighing.and.returnValue(of(weighing));
    const recorded: ArrivalWeighing[] = [];
    fixture.componentInstance.recorded.subscribe((w) => recorded.push(w));
    fixture.detectChanges();
    await fixture.whenStable();
    set('#arrivalGross', '18000');
    set('#arrivalTare', '8200');
    (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    expect(api.registerArrivalWeighing).toHaveBeenCalledWith(
      'r1',
      {grossKg: 18000, tareKg: 8200, ticketPhotoUrl: null},
      jasmine.any(String),
    );
    expect(recorded).toEqual([weighing]);
  });

  it('muestra la comparación con la salida y el veredicto', () => {
    fixture.componentRef.setInput('weighing', weighing);
    fixture.detectChanges();
    expect(element.textContent).toContain('Fuera de tolerancia');
    expect(element.querySelector('form')).toBeNull();
  });

  it('sin pesaje de salida avisa que no se puede comparar', () => {
    fixture.componentRef.setInput('weighing', {
      ...weighing,
      departureNetKg: null,
      differenceKg: null,
      differencePercent: null,
      withinTolerance: null,
    });
    fixture.detectChanges();
    expect(element.textContent).toContain('Sin pesaje de salida');
  });
});

describe('ReceptionPageComponent (Sprint 3)', () => {
  let api: jasmine.SpyObj<LogisticsApi>;
  let fixture: ComponentFixture<ReceptionPageComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    api = jasmine.createSpyObj<LogisticsApi>('LogisticsApi', [
      'openReception',
      'getComparison',
      'saveReceptionLine',
      'savePartialReception',
      'confirmReception',
      'listDiscrepancies',
    ]);
    api.getComparison.and.returnValue(
      of({receptionId: 'r1', dispatchId: 'd1', orderId: 'o1', status: 'IN_PROGRESS', complete: true, withinTolerance: true, lines: []}),
    );
    TestBed.configureTestingModule({
      imports: [ReceptionPageComponent],
      providers: [provideRouter([]), {provide: LogisticsApi, useValue: api}],
    });
    fixture = TestBed.createComponent(ReceptionPageComponent);
    fixture.componentRef.setInput('dispatchId', 'd1');
    element = fixture.nativeElement as HTMLElement;
  });

  it('guarda una recepción parcial y deja la recepción abierta', () => {
    api.openReception.and.returnValue(of(reception()));
    api.savePartialReception.and.returnValue(
      of(reception({status: 'PARTIALLY_RECEIVED', partialCount: 1, lastPartialAt: '2026-10-08T12:00:00Z'})),
    );
    fixture.detectChanges();
    (element.querySelector('button.partial') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(api.savePartialReception).toHaveBeenCalledWith('r1', jasmine.any(String));
    expect(element.querySelector('.partial-note')?.textContent).toContain('1 vez');
    expect(element.querySelector('button.confirm')).not.toBeNull();
  });

  it('tras confirmar avisa de las discrepancias abiertas con enlace a cada una', () => {
    api.openReception.and.returnValue(of(reception()));
    api.confirmReception.and.returnValue(of(reception({status: 'CONFIRMED'})));
    api.listDiscrepancies.and.returnValue(
      of([
        {
          id: 'x1',
          organizationId: 'org',
          receptionId: 'r1',
          dispatchId: 'd1',
          manifestCode: 'MAN-1',
          worksiteId: 'w1',
          warehouseId: 'a1',
          materialId: 'm1',
          sku: 'CEM-001',
          materialName: 'Cemento',
          type: 'SHORTAGE',
          quantity: 10,
          shrinkagePercent: 10,
          tolerancePercent: 2.5,
          observation: null,
          status: 'OPEN',
          openedBy: 'u1',
          openedAt: '2026-10-08T12:00:00Z',
          evidences: [],
        },
      ]),
    );
    fixture.detectChanges();
    (element.querySelector('button.confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(api.listDiscrepancies).toHaveBeenCalledWith({dispatchId: 'd1'});
    const notice = element.querySelector('.discrepancy-notice');
    expect(notice?.textContent).toContain('1 discrepancia abierta');
    expect(notice?.querySelector('a')?.getAttribute('href')).toBe('/discrepancies/x1');
    expect(element.querySelector('app-report-discrepancy')).not.toBeNull();
  });
});
