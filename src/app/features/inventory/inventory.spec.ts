import {HttpErrorResponse} from '@angular/common/http';
import {TestBed} from '@angular/core/testing';
import {Router, provideRouter} from '@angular/router';
import {of, throwError} from 'rxjs';

import {InventoryApiService} from '../../core/api/inventory-api.service';
import {OrganizationApiService} from '../../core/api/organization-api.service';
import {toApiError} from '../../core/http/api-error';
import {StockCount} from '../../core/models/inventory';
import {StockPageComponent} from '../catalog/stock-page.component';
import {CountDetailPageComponent} from './count-detail-page.component';
import {CountListPageComponent} from './count-list-page.component';
import {MovementsPageComponent, limaDayStart, limaNextDayStart, movementBadge} from './movements-page.component';

const WAREHOUSE = {id: 'w1', name: 'Almacén Central', type: 'WAREHOUSE' as const, address: 'Av. 1', active: true};
const MATERIAL = {id: 'm1', sku: 'CEM-001', name: 'Cemento', unit: 'BAG' as const, wasteTolerancePercent: 2, active: true};

function count(overrides: Partial<StockCount> = {}): StockCount {
  return {
    id: 'c1',
    warehouseId: 'w1',
    warehouseName: 'Almacén Central',
    status: 'IN_PROGRESS',
    note: null,
    startedBy: 'u1',
    startedAt: '2026-10-11T10:00:00Z',
    finishedAt: null,
    differenceCount: 0,
    reviewNote: null,
    reviewedBy: null,
    reviewedAt: null,
    adjustmentReason: null,
    adjustedBy: null,
    adjustedAt: null,
    cancelledAt: null,
    lines: [
      {materialId: 'm1', sku: 'CEM-001', materialName: 'Cemento', unit: 'BAG', countedQty: null, systemQty: null, difference: null},
      {materialId: 'm2', sku: 'FIE-001', materialName: 'Fierro', unit: 'UNIT', countedQty: null, systemQty: null, difference: null},
    ],
    ...overrides,
  };
}

describe('Inventario (US40 y US41)', () => {
  let inventory: jasmine.SpyObj<InventoryApiService>;
  let organization: jasmine.SpyObj<OrganizationApiService>;
  let router: Router;

  function setup(): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {provide: InventoryApiService, useValue: inventory},
        {provide: OrganizationApiService, useValue: organization},
      ],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  }

  function type(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  beforeEach(() => {
    inventory = jasmine.createSpyObj<InventoryApiService>('InventoryApiService', [
      'movementHistory',
      'listCounts',
      'getCount',
      'startCount',
      'saveCountLines',
      'finishCount',
      'reviewCount',
      'adjustCount',
      'cancelCount',
    ]);
    organization = jasmine.createSpyObj<OrganizationApiService>('OrganizationApiService', [
      'listWarehouses',
      'listMaterials',
      'listStock',
      'registerStockEntry',
    ]);
    organization.listWarehouses.and.returnValue(of([WAREHOUSE]));
    organization.listMaterials.and.returnValue(of([MATERIAL]));
  });

  it('convierte los días de Lima a instantes UTC para el historial', () => {
    expect(limaDayStart('2026-10-01')).toBe('2026-10-01T05:00:00Z');
    expect(limaNextDayStart('2026-10-31')).toBe('2026-11-01T05:00:00Z');
    expect(movementBadge('REPLENISHMENT')).toBe('badge-ok');
    expect(movementBadge('ADJUSTMENT_OUT')).toBe('badge-bad');
  });

  it('registra la entrada como inventario inicial o reposición (T90)', () => {
    organization.listStock.and.returnValue(of([]));
    organization.registerStockEntry.and.returnValue(of({}));
    setup();
    const fixture = TestBed.createComponent(StockPageComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const select = (id: string, value: string) => {
      const el = element.querySelector(`#${id}`) as HTMLSelectElement;
      el.value = value;
      el.dispatchEvent(new Event('change'));
    };
    select('warehouse', 'w1');
    select('material', 'm1');
    select('entryType', 'INITIAL');
    type(element.querySelector('#quantity') as HTMLInputElement, '100');
    (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(organization.registerStockEntry).toHaveBeenCalledWith(
      jasmine.objectContaining({warehouseId: 'w1', materialId: 'm1', quantity: 100, entryType: 'INITIAL'}),
    );
    expect(element.textContent).toContain('Inventario inicial registrado');
    expect(element.querySelector('.tabs')).not.toBeNull();
  });

  it('filtra y pagina el historial de movimientos (T90)', () => {
    inventory.movementHistory.and.returnValue(
      of({
        items: [
          {
            id: 'mv1',
            locationId: 'w1',
            locationType: 'WAREHOUSE',
            locationName: 'Almacén Central',
            materialId: 'm1',
            sku: 'CEM-001',
            type: 'REPLENISHMENT',
            quantity: 200,
            balanceAfter: 650,
            reference: 'Guía 001',
            occurredAt: '2026-10-05T14:00:00Z',
            recordedBy: 'u1',
          },
        ],
        page: 0,
        size: 20,
        total: 45,
      }),
    );
    setup();
    const fixture = TestBed.createComponent(MovementsPageComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid="movements"]')?.textContent).toContain('Reposición');
    expect(element.querySelector('[data-testid="pager-status"]')?.textContent).toContain('Página 1 de 3');

    const typeSelect = element.querySelector('#f-type') as HTMLSelectElement;
    typeSelect.value = 'REPLENISHMENT';
    typeSelect.dispatchEvent(new Event('change'));
    type(element.querySelector('#f-from') as HTMLInputElement, '2026-10-01');
    (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    expect(inventory.movementHistory).toHaveBeenCalledWith(
      jasmine.objectContaining({type: 'REPLENISHMENT', from: '2026-10-01T05:00:00Z', page: 0, size: 20}),
    );
    fixture.detectChanges();
    const next = Array.from(element.querySelectorAll('.pager button')).find((b) => b.textContent?.includes('Siguiente')) as HTMLButtonElement;
    next.click();
    expect(inventory.movementHistory).toHaveBeenCalledWith(jasmine.objectContaining({page: 1}));
  });

  it('inicia un conteo y abre su detalle (T91)', () => {
    inventory.listCounts.and.returnValue(of([]));
    inventory.startCount.and.returnValue(of(count()));
    setup();
    const fixture = TestBed.createComponent(CountListPageComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const select = element.querySelector('#c-warehouse') as HTMLSelectElement;
    select.value = 'w1';
    select.dispatchEvent(new Event('change'));
    (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    expect(inventory.startCount).toHaveBeenCalledWith('w1', null);
    expect(router.navigate).toHaveBeenCalledWith(['/stock/counts', 'c1']);
  });

  describe('CountDetailPageComponent (T91)', () => {
    function open(initial: StockCount) {
      inventory.getCount.and.returnValue(of(initial));
      setup();
      const fixture = TestBed.createComponent(CountDetailPageComponent);
      fixture.componentRef.setInput('id', 'c1');
      fixture.detectChanges();
      return {fixture, element: fixture.nativeElement as HTMLElement};
    }

    it('exige contar todo antes de finalizar y luego guarda y finaliza', () => {
      const finished = count({
        status: 'DIFFERENCES_FOUND',
        differenceCount: 1,
        lines: [
          {materialId: 'm1', sku: 'CEM-001', materialName: 'Cemento', unit: 'BAG', countedQty: 95, systemQty: 100, difference: -5},
          {materialId: 'm2', sku: 'FIE-001', materialName: 'Fierro', unit: 'UNIT', countedQty: 40, systemQty: 40, difference: 0},
        ],
      });
      inventory.saveCountLines.and.returnValue(of(count()));
      inventory.finishCount.and.returnValue(of(finished));
      const {fixture, element} = open(count());
      const inputs = element.querySelectorAll<HTMLInputElement>('input.qty');
      type(inputs[0], '95');
      (element.querySelector('[data-testid="finish-count"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(inventory.finishCount).not.toHaveBeenCalled();
      expect(element.textContent).toContain('todos los materiales');

      type(inputs[1], '40');
      (element.querySelector('[data-testid="finish-count"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(inventory.saveCountLines).toHaveBeenCalledWith('c1', [
        {materialId: 'm1', countedQty: 95},
        {materialId: 'm2', countedQty: 40},
      ]);
      expect(inventory.finishCount).toHaveBeenCalledWith('c1');
      expect(element.querySelector('[data-testid="count-status"]')?.textContent).toContain('Con diferencias');
      expect(element.querySelector('[data-testid="count-lines"]')?.textContent).toContain('-5');
    });

    it('revisa con nota y ajusta con motivo; explica el faltante sin stock disponible', () => {
      const reviewed = count({status: 'REVIEWED', differenceCount: 1, reviewNote: 'Recontado'});
      inventory.reviewCount.and.returnValue(of(reviewed));
      inventory.adjustCount.and.returnValue(
        throwError(() => toApiError(new HttpErrorResponse({status: 409, error: {code: 'INSUFFICIENT_STOCK'}}))),
      );
      const {fixture, element} = open(count({status: 'DIFFERENCES_FOUND', differenceCount: 1}));
      type(element.querySelector('#review-note') as HTMLTextAreaElement, 'Recontado');
      fixture.detectChanges();
      (element.querySelector('[data-testid="review-count"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(inventory.reviewCount).toHaveBeenCalledWith('c1', 'Recontado');

      type(element.querySelector('#adjust-reason') as HTMLTextAreaElement, 'Rotura');
      fixture.detectChanges();
      (element.querySelector('[data-testid="adjust-count"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(inventory.adjustCount).toHaveBeenCalledWith('c1', 'Rotura');
      expect(element.textContent).toContain('reservado para despachos');
    });

    it('anula un conteo sin tocar el inventario', () => {
      inventory.cancelCount.and.returnValue(of(count({status: 'CANCELLED'})));
      const {fixture, element} = open(count());
      (Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes('Anular conteo')) as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(inventory.cancelCount).toHaveBeenCalledWith('c1');
      expect(element.textContent).toContain('El inventario no cambió');
    });
  });
});
