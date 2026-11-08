import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, Router, convertToParamMap, provideRouter} from '@angular/router';
import {of} from 'rxjs';

import {InventoryApiService} from '../../core/api/inventory-api.service';
import {OrganizationApiService} from '../../core/api/organization-api.service';
import {AuthService} from '../../core/auth/auth.service';
import {MaterialReturn} from '../../core/models/inventory';
import {Role} from '../../core/models/role';
import {ReturnCreatePageComponent} from './return-create-page.component';
import {ReturnDetailPageComponent} from './return-detail-page.component';
import {ReturnListPageComponent} from './return-list-page.component';
import {returnActions} from './return-status';

function materialReturn(overrides: Partial<MaterialReturn> = {}): MaterialReturn {
  return {
    id: 'r1',
    worksiteId: 'ws1',
    worksiteName: 'Torre Norte',
    warehouseId: 'w1',
    warehouseName: 'Almacén Central',
    status: 'REGISTERED',
    note: null,
    hasRejections: false,
    registeredBy: 'u1',
    registeredAt: '2026-10-11T10:00:00Z',
    requestedBy: null,
    requestedAt: null,
    decidedBy: null,
    decidedAt: null,
    rejectionReason: null,
    dispatchedBy: null,
    dispatchedAt: null,
    receivedBy: null,
    receivedAt: null,
    cancelledAt: null,
    lines: [
      {
        id: 'l1',
        materialId: 'm1',
        sku: 'CEM-001',
        materialName: 'Cemento',
        unit: 'BAG',
        quantity: 12,
        detail: 'Bolsas cerradas',
        acceptedQty: null,
        rejectedQty: null,
        rejectionReason: null,
      },
    ],
    ...overrides,
  };
}

describe('Devoluciones de saldos (US43)', () => {
  let api: jasmine.SpyObj<InventoryApiService>;
  let organization: jasmine.SpyObj<OrganizationApiService>;
  let router: Router;

  function setup(role: Role, query: Record<string, string> = {}): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {provide: InventoryApiService, useValue: api},
        {provide: OrganizationApiService, useValue: organization},
        {provide: AuthService, useValue: {role: signal(role)}},
        {provide: ActivatedRoute, useValue: {snapshot: {queryParamMap: convertToParamMap(query)}}},
      ],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  }

  function type(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function button(element: HTMLElement, text: string): HTMLButtonElement {
    return Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) as HTMLButtonElement;
  }

  beforeEach(() => {
    api = jasmine.createSpyObj<InventoryApiService>('InventoryApiService', [
      'listReturns',
      'getReturn',
      'worksiteBalance',
      'registerReturn',
      'requestReturn',
      'approveReturn',
      'rejectReturn',
      'dispatchReturn',
      'receiveReturn',
      'cancelReturn',
    ]);
    organization = jasmine.createSpyObj<OrganizationApiService>('OrganizationApiService', ['listWorksites']);
  });

  it('cada rol ve solo sus pasos', () => {
    expect(returnActions({status: 'REGISTERED'}, 'SITE_MANAGER')).toEqual(['request', 'cancel']);
    expect(returnActions({status: 'REGISTERED'}, 'WAREHOUSE_MANAGER')).toEqual([]);
    expect(returnActions({status: 'REQUESTED'}, 'WAREHOUSE_MANAGER')).toEqual(['approve', 'reject']);
    expect(returnActions({status: 'REQUESTED'}, 'SITE_MANAGER')).toEqual(['cancel']);
    expect(returnActions({status: 'APPROVED'}, 'SITE_MANAGER')).toEqual(['dispatch']);
    expect(returnActions({status: 'IN_TRANSIT'}, 'WAREHOUSE_MANAGER')).toEqual(['receive']);
    expect(returnActions({status: 'IN_TRANSIT'}, 'ADMINISTRATOR')).toEqual(['receive']);
    expect(returnActions({status: 'RECEIVED'}, 'ADMINISTRATOR')).toEqual([]);
  });

  it('lista las devoluciones y solo la obra o el administrador pueden registrar', () => {
    api.listReturns.and.returnValue(of([materialReturn({status: 'REQUESTED'})]));
    setup('WAREHOUSE_MANAGER');
    const fixture = TestBed.createComponent(ReturnListPageComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid="returns"]')?.textContent).toContain('Solicitada');
    expect(element.querySelector('[data-testid="returns"] a')?.textContent).toContain('Atender');
    expect(element.textContent).not.toContain('Devolver saldo de obra');
  });

  it('muestra el saldo de la obra y registra la devolución (T92)', () => {
    organization.listWorksites.and.returnValue(
      of([{id: 'ws1', name: 'Torre Norte', address: '', district: '', city: '', latitude: null, longitude: null, startDate: '2026-01-01', endDate: null}]),
    );
    api.worksiteBalance.and.returnValue(
      of({
        worksiteId: 'ws1',
        worksiteName: 'Torre Norte',
        lines: [
          {
            materialId: 'm1',
            sku: 'CEM-001',
            materialName: 'Cemento',
            unit: 'BAG',
            availableQty: 30,
            pendingReturnQty: 5,
            returnableQty: 25,
            originWarehouses: [{warehouseId: 'w1', warehouseName: 'Almacén Central'}],
          },
        ],
      }),
    );
    api.registerReturn.and.returnValue(of(materialReturn()));
    setup('SITE_MANAGER');
    const fixture = TestBed.createComponent(ReturnCreatePageComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid="balance"]')?.textContent).toContain('25');

    type(element.querySelector('input.qty') as HTMLInputElement, '30');
    fixture.detectChanges();
    (element.querySelector('[data-testid="register-return"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(api.registerReturn).not.toHaveBeenCalled();
    expect(element.textContent).toContain('supera lo que la obra puede devolver');

    type(element.querySelector('input.qty') as HTMLInputElement, '12');
    type(element.querySelector('input.detail') as HTMLInputElement, 'Bolsas cerradas');
    fixture.detectChanges();
    (element.querySelector('[data-testid="register-return"]') as HTMLButtonElement).click();
    expect(api.registerReturn).toHaveBeenCalledWith({
      worksiteId: 'ws1',
      warehouseId: null,
      note: null,
      lines: [{materialId: 'm1', quantity: 12, detail: 'Bolsas cerradas'}],
    });
    expect(router.navigate).toHaveBeenCalledWith(['/returns', 'r1'], {queryParams: {registrada: 1}});
  });

  describe('ReturnDetailPageComponent', () => {
    function open(role: Role, ret: MaterialReturn) {
      api.getReturn.and.returnValue(of(ret));
      setup(role);
      const fixture = TestBed.createComponent(ReturnDetailPageComponent);
      fixture.componentRef.setInput('id', 'r1');
      fixture.detectChanges();
      return {fixture, element: fixture.nativeElement as HTMLElement};
    }

    it('la obra solicita la devolución', () => {
      api.requestReturn.and.returnValue(of(materialReturn({status: 'REQUESTED'})));
      const {fixture, element} = open('SITE_MANAGER', materialReturn());
      button(element, 'Solicitar devolución').click();
      fixture.detectChanges();
      expect(api.requestReturn).toHaveBeenCalledWith('r1');
      expect(element.querySelector('[data-testid="return-status"]')?.textContent).toContain('Solicitada');
      expect(button(element, 'Aprobar')).toBeUndefined();
    });

    it('el almacén rechaza con motivo', () => {
      api.rejectReturn.and.returnValue(of(materialReturn({status: 'REJECTED', rejectionReason: 'Es de otra obra'})));
      const {fixture, element} = open('WAREHOUSE_MANAGER', materialReturn({status: 'REQUESTED'}));
      button(element, 'Rechazar').click();
      fixture.detectChanges();
      type(element.querySelector('#reject-reason') as HTMLTextAreaElement, 'Es de otra obra');
      fixture.detectChanges();
      (element.querySelector('[data-testid="confirm-reject"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(api.rejectReturn).toHaveBeenCalledWith('r1', 'Es de otra obra');
      expect(element.textContent).toContain('El saldo sigue en la obra');
    });

    it('el almacén recibe con una parte rechazada y su motivo', () => {
      api.receiveReturn.and.returnValue(
        of(
          materialReturn({
            status: 'RECEIVED',
            hasRejections: true,
            lines: [{...materialReturn().lines[0], acceptedQty: 10, rejectedQty: 2, rejectionReason: 'Húmedas'}],
          }),
        ),
      );
      const {fixture, element} = open('WAREHOUSE_MANAGER', materialReturn({status: 'IN_TRANSIT'}));
      button(element, 'Recibir en almacén').click();
      fixture.detectChanges();
      type(element.querySelector('input.qty') as HTMLInputElement, '10');
      fixture.detectChanges();
      (element.querySelector('[data-testid="receive-return"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(api.receiveReturn).not.toHaveBeenCalled();
      expect(element.textContent).toContain('Explica por qué');

      type(element.querySelector('input.reason') as HTMLInputElement, 'Húmedas');
      fixture.detectChanges();
      (element.querySelector('[data-testid="receive-return"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(api.receiveReturn).toHaveBeenCalledWith('r1', [{materialId: 'm1', acceptedQty: 10, rejectionReason: 'Húmedas'}]);
      expect(element.querySelector('[data-testid="return-lines"]')?.textContent).toContain('Húmedas');
      expect(element.textContent).toContain('Lo rechazado no vuelve al stock');
    });
  });
});
