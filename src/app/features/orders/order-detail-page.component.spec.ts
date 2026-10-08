import {ComponentFixture, TestBed, fakeAsync, tick} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';

import {LogisticsApi} from '../../core/api/logistics-api';
import {OrdersApiService} from '../../core/api/orders-api.service';
import {OrganizationApiService} from '../../core/api/organization-api.service';
import {AuthService} from '../../core/auth/auth.service';
import {Order} from '../../core/models/order';
import {APPROVAL_POLL_ATTEMPTS, APPROVAL_POLL_MS, OrderDetailPageComponent} from './order-detail-page.component';

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    worksiteId: 'w1',
    warehouseId: 'a1',
    requestedBy: 'u1',
    status: 'REGISTERED',
    statusLabel: 'Registrado',
    notes: null,
    rejectionReason: null,
    placedAt: '2026-10-08T10:00:00Z',
    decidedBy: null,
    decidedAt: null,
    lines: [],
    ...overrides,
  };
}

describe('OrderDetailPageComponent (aprobación con reserva de stock)', () => {
  let fixture: ComponentFixture<OrderDetailPageComponent>;
  let ordersApi: jasmine.SpyObj<OrdersApiService>;
  let element: HTMLElement;

  beforeEach(() => {
    ordersApi = jasmine.createSpyObj<OrdersApiService>('OrdersApiService', ['get', 'approve', 'reject']);
    ordersApi.get.and.returnValue(of(order()));
    TestBed.configureTestingModule({
      imports: [OrderDetailPageComponent],
      providers: [
        provideRouter([]),
        {provide: OrdersApiService, useValue: ordersApi},
        {
          provide: OrganizationApiService,
          useValue: {listWorksites: () => of([]), listWarehouses: () => of([])},
        },
        {provide: LogisticsApi, useValue: {listDispatches: () => of([])}},
        {provide: AuthService, useValue: {hasAnyRole: () => true}},
      ],
    });
    fixture = TestBed.createComponent(OrderDetailPageComponent);
    fixture.componentRef.setInput('id', 'o1');
    element = fixture.nativeElement as HTMLElement;
  });

  function approveButton(): HTMLButtonElement {
    return Array.from(element.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Aprobar pedido'),
    ) as HTMLButtonElement;
  }

  it('consulta el pedido mientras está «Aprobando» y muestra el resultado', fakeAsync(() => {
    fixture.detectChanges();
    ordersApi.approve.and.returnValue(of(order({status: 'APPROVAL_PENDING', statusLabel: 'Aprobando'})));
    ordersApi.get.and.returnValues(
      of(order({status: 'APPROVAL_PENDING'})),
      of(order({status: 'IN_REVIEW', statusLabel: 'Aprobado'})),
    );
    approveButton().click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Aprobando');

    tick(APPROVAL_POLL_MS * 2);
    fixture.detectChanges();
    expect(ordersApi.get).toHaveBeenCalledTimes(3);
    expect(element.textContent).toContain('Pedido aprobado y stock reservado.');
    tick(APPROVAL_POLL_MS * APPROVAL_POLL_ATTEMPTS);
    expect(ordersApi.get).toHaveBeenCalledTimes(3);
  }));

  it('muestra el motivo cuando la reserva se rechaza y el pedido vuelve a Registrado', fakeAsync(() => {
    fixture.detectChanges();
    ordersApi.approve.and.returnValue(of(order({status: 'APPROVAL_PENDING'})));
    ordersApi.get.and.returnValue(
      of(order({rejectionReason: 'Stock insuficiente en el almacén para ACE-012 (hay 10, se pidió 25)'})),
    );
    approveButton().click();
    tick(APPROVAL_POLL_MS);
    fixture.detectChanges();
    expect(element.textContent).toContain('No se pudo aprobar:');
    expect(element.textContent).toContain('hay 10, se pidió 25');
    expect(approveButton()).toBeTruthy();
  }));

  it('deja de consultar tras varios intentos y avisa que siga en curso', fakeAsync(() => {
    fixture.detectChanges();
    ordersApi.approve.and.returnValue(of(order({status: 'APPROVAL_PENDING'})));
    ordersApi.get.and.returnValue(of(order({status: 'APPROVAL_PENDING'})));
    approveButton().click();
    tick(APPROVAL_POLL_MS * (APPROVAL_POLL_ATTEMPTS + 2));
    fixture.detectChanges();
    expect(ordersApi.get).toHaveBeenCalledTimes(1 + APPROVAL_POLL_ATTEMPTS);
    expect(element.textContent).toContain('sigue en curso');
  }));
});
