import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of, throwError} from 'rxjs';

import {LogisticsApi} from '../../core/api/logistics-api';
import {AuthService} from '../../core/auth/auth.service';
import {ApiError} from '../../core/http/api-error';
import {Dispatch, TransitIncident} from '../../core/models/logistics';
import {CustodyPageComponent, custodyTone} from './custody-page.component';
import {DispatchCancelComponent} from './dispatch-cancel.component';
import {DispatchIncidentsComponent} from './dispatch-incidents.component';

function dispatch(overrides: Partial<Dispatch> = {}): Dispatch {
  return {
    id: 'd1',
    orderId: 'o1',
    warehouseId: 'a1',
    worksiteId: 'w1',
    type: 'COMPLETE',
    status: 'PREPARED',
    manifestCode: 'MAN-1',
    preparedAt: '2026-10-08T10:00:00Z',
    departedAt: null,
    receivedAt: null,
    carrier: null,
    departureWeighing: null,
    lines: [],
    ...overrides,
  };
}

function click(element: HTMLElement, selector: string): void {
  (element.querySelector(selector) as HTMLElement).click();
}

function type(element: HTMLElement, selector: string, value: string): void {
  const field = element.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
  field.value = value;
  field.dispatchEvent(new Event('input'));
}

describe('DispatchCancelComponent (US25)', () => {
  let fixture: ComponentFixture<DispatchCancelComponent>;
  let api: jasmine.SpyObj<LogisticsApi>;
  let element: HTMLElement;
  let cancelled: Dispatch[];

  beforeEach(() => {
    api = jasmine.createSpyObj<LogisticsApi>('LogisticsApi', ['cancelDispatch']);
    TestBed.configureTestingModule({
      imports: [DispatchCancelComponent],
      providers: [{provide: LogisticsApi, useValue: api}],
    });
    fixture = TestBed.createComponent(DispatchCancelComponent);
    fixture.componentRef.setInput('dispatchId', 'd1');
    element = fixture.nativeElement as HTMLElement;
    cancelled = [];
    fixture.componentInstance.cancelled.subscribe((d) => cancelled.push(d));
    fixture.detectChanges();
  });

  it('pide el motivo antes de anular', async () => {
    click(element, 'button.open-cancel');
    fixture.detectChanges();
    click(element, 'button.confirm-cancel');
    fixture.detectChanges();
    expect(api.cancelDispatch).not.toHaveBeenCalled();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('motivo');
  });

  it('anula con el motivo y una clave de idempotencia, y avisa al padre', async () => {
    api.cancelDispatch.and.returnValue(of(dispatch({status: 'CANCELLED'})));
    click(element, 'button.open-cancel');
    fixture.detectChanges();
    await fixture.whenStable();
    type(element, '#cancelReason', '  La obra pidió postergar  ');
    click(element, 'button.confirm-cancel');
    fixture.detectChanges();

    const [id, reason, key] = api.cancelDispatch.calls.mostRecent().args;
    expect(id).toBe('d1');
    expect(reason).toBe('La obra pidió postergar');
    expect(key).toBeTruthy();
    expect(cancelled[0].status).toBe('CANCELLED');
  });

  it('muestra el 409 del backend si el despacho ya salió', async () => {
    api.cancelDispatch.and.returnValue(
      throwError(() => new ApiError(409, 'INVALID_DISPATCH_TRANSITION', 'El despacho ya salió del almacén.')),
    );
    click(element, 'button.open-cancel');
    fixture.detectChanges();
    await fixture.whenStable();
    type(element, '#cancelReason', 'Motivo válido');
    click(element, 'button.confirm-cancel');
    fixture.detectChanges();
    expect(element.textContent).toContain('El despacho ya salió del almacén.');
    expect(cancelled).toEqual([]);
  });
});

describe('DispatchIncidentsComponent (US32)', () => {
  let fixture: ComponentFixture<DispatchIncidentsComponent>;
  let api: jasmine.SpyObj<LogisticsApi>;
  let element: HTMLElement;
  const incident: TransitIncident = {
    id: 'i1',
    dispatchId: 'd1',
    type: 'DELAY',
    observation: 'Tráfico en la Panamericana',
    reportedBy: 'Ana',
    reportedAt: '2026-10-08T11:00:00Z',
  };

  function create(canReport: boolean): void {
    fixture = TestBed.createComponent(DispatchIncidentsComponent);
    fixture.componentRef.setInput('dispatchId', 'd1');
    fixture.componentRef.setInput('canReport', canReport);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  beforeEach(() => {
    api = jasmine.createSpyObj<LogisticsApi>('LogisticsApi', ['listIncidents', 'registerIncident']);
    api.listIncidents.and.returnValue(of([incident]));
    TestBed.configureTestingModule({
      imports: [DispatchIncidentsComponent],
      providers: [{provide: LogisticsApi, useValue: api}],
    });
  });

  it('lista las incidencias con su tipo en español', () => {
    create(false);
    expect(element.textContent).toContain('Retraso');
    expect(element.textContent).toContain('Tráfico en la Panamericana');
    expect(element.querySelector('form')).toBeNull();
  });

  it('registra una incidencia nueva cuando el despacho está en tránsito', async () => {
    api.registerIncident.and.returnValue(of({...incident, id: 'i2', type: 'ACCIDENT', observation: 'Choque leve'}));
    create(true);
    await fixture.whenStable();
    const select = element.querySelector('#incidentType') as HTMLSelectElement;
    select.value = 'ACCIDENT';
    select.dispatchEvent(new Event('change'));
    type(element, '#incidentObservation', 'Choque leve');
    (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(api.registerIncident).toHaveBeenCalledWith('d1', {type: 'ACCIDENT', observation: 'Choque leve'}, jasmine.any(String));
    expect(element.querySelectorAll('.incidents li').length).toBe(2);
    expect(element.textContent).toContain('Accidente');
  });
});

describe('CustodyPageComponent (US39)', () => {
  it('asigna un tono a cada tipo de evento', () => {
    expect(custodyTone('RECEIVED')).toBe('ok');
    expect(custodyTone('CANCELLED')).toBe('bad');
    expect(custodyTone('INCIDENT')).toBe('warn');
    expect(custodyTone('DEPARTED')).toBe('info');
    expect(custodyTone('PREPARED')).toBe('plain');
  });

  it('muestra la línea de tiempo con responsable y vuelve según el rol', () => {
    const api = jasmine.createSpyObj<LogisticsApi>('LogisticsApi', ['getCustody']);
    api.getCustody.and.returnValue(
      of({
        dispatchId: 'd1',
        manifestCode: 'MAN-1',
        events: [
          {at: '2026-10-08T10:00:00Z', type: 'PREPARED', label: 'Despacho preparado', actorId: 'u1', actorName: 'Ana', detail: null},
          {at: '2026-10-08T11:00:00Z', type: 'DEPARTED', label: 'Salida del almacén', actorId: null, actorName: null, detail: 'Placa ABC-123'},
        ],
      }),
    );
    TestBed.configureTestingModule({
      imports: [CustodyPageComponent],
      providers: [
        provideRouter([]),
        {provide: LogisticsApi, useValue: api},
        {provide: AuthService, useValue: {hasAnyRole: () => false}},
      ],
    });
    const fixture = TestBed.createComponent(CustodyPageComponent);
    fixture.componentRef.setInput('id', 'd1');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    const items = element.querySelectorAll('.timeline li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Responsable: Ana');
    expect(items[1].textContent).toContain('Placa ABC-123');
    expect(items[1].textContent).toContain('Registrado por el sistema');
    expect(element.querySelector('h1')?.textContent).toContain('MAN-1');
    expect(element.querySelector('.page-header a')?.getAttribute('href')).toBe('/reception');
  });
});
