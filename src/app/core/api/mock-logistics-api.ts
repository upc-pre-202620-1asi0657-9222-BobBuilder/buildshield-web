import {Injectable, inject} from '@angular/core';
import {Observable, catchError, defer, delay, forkJoin, map, of, switchMap, throwError} from 'rxjs';

import {ApiError} from '../http/api-error';
import {RetryObserver} from '../http/http-context';
import {
  Carrier,
  ComparisonRow,
  CreateDispatchRequest,
  DepartureWeighing,
  Dispatch,
  DispatchManifest,
  Reception,
} from '../models/logistics';
import {Material} from '../models/organization';
import {orderLineKey} from '../models/order';
import {generateUuid} from '../util/uuid';
import {DispatchFilter, LogisticsApi, computeShrinkage} from './logistics-api';
import {OrganizationApiService} from './organization-api.service';
import {OrdersApiService} from './orders-api.service';

const STORAGE_KEY = 'buildshield.mock.logistics';
const LATENCY_MS = 250;

interface MockDispatchLine {
  id: string;
  orderLineId: string;
  materialId: string;
  sku: string;
  materialName?: string;
  unit: string;
  quantity: number;
  requested: number;
  tolerancePercent: number;
}

interface MockDispatch extends Omit<Dispatch, 'lines'> {
  lines: MockDispatchLine[];
}

interface MockStore {
  dispatches: MockDispatch[];
  receptions: Reception[];
}

/**
 * Simulación en memoria (persistida en localStorage) de los endpoints de
 * despachos y recepciones del Sprint 2, para usar la interfaz mientras el
 * backend no los publique. Se activa con environment.mockSprint2.
 */
@Injectable()
export class MockLogisticsApi extends LogisticsApi {
  override readonly simulated = true;

  private readonly orders = inject(OrdersApiService);
  private readonly organization = inject(OrganizationApiService);
  private store: MockStore = loadStore();

  override listDispatches(filter: DispatchFilter = {}): Observable<Dispatch[]> {
    return this.respond(() =>
      this.store.dispatches
        .filter((d) => !filter.orderId || d.orderId === filter.orderId)
        .filter((d) => !filter.status || d.status === filter.status)
        .map(toDispatch),
    );
  }

  override getDispatch(id: string): Observable<Dispatch> {
    return this.respond(() => toDispatch(this.findDispatch(id)));
  }

  override createDispatch(request: CreateDispatchRequest): Observable<Dispatch> {
    if (request.lines.length === 0) {
      return this.fail(400, 'DISPATCH_WITHOUT_LINES', 'El despacho debe tener al menos una línea.');
    }
    const materials$ = this.organization
      .listMaterials()
      .pipe(catchError(() => of([] as Material[])));
    return forkJoin([this.orders.get(request.orderId), materials$]).pipe(
      switchMap(([order, materials]) =>
        this.respond(() => {
          const lines: MockDispatchLine[] = request.lines.map((requested) => {
            const orderLine = order.lines.find((l) => orderLineKey(l) === requested.orderLineId);
            if (!orderLine) {
              throw new ApiError(400, 'MATERIAL_NOT_IN_ORDER', 'La línea no pertenece al pedido.');
            }
            if (requested.quantity <= 0 || requested.quantity > orderLine.pending) {
              throw new ApiError(
                409,
                'DISPATCH_EXCEEDS_PENDING',
                `La cantidad de ${orderLine.sku} supera lo pendiente (${orderLine.pending}).`,
              );
            }
            const material = materials.find((m) => m.id === orderLine.materialId);
            return {
              id: generateUuid(),
              orderLineId: requested.orderLineId,
              materialId: orderLine.materialId,
              sku: orderLine.sku,
              materialName: material?.name,
              unit: orderLine.unit,
              quantity: requested.quantity,
              requested: orderLine.requested,
              tolerancePercent: Number(material?.wasteTolerancePercent ?? 0),
            };
          });
          const dispatch: MockDispatch = {
            id: generateUuid(),
            code: nextCode(this.store.dispatches.length),
            orderId: order.id,
            worksiteId: order.worksiteId,
            warehouseId: order.warehouseId,
            status: 'PREPARING',
            carrier: null,
            departureWeighing: null,
            createdAt: new Date().toISOString(),
            departedAt: null,
            lines,
          };
          this.store.dispatches.unshift(dispatch);
          this.save();
          return toDispatch(dispatch);
        }),
      ),
    );
  }

  override setCarrier(id: string, carrier: Carrier): Observable<Dispatch> {
    return this.respond(() => {
      const dispatch = this.findPreparing(id);
      dispatch.carrier = {...carrier};
      this.save();
      return toDispatch(dispatch);
    });
  }

  override registerDepartureWeighing(id: string, weighing: DepartureWeighing): Observable<Dispatch> {
    return this.respond(() => {
      if (weighing.grossKg <= weighing.tareKg) {
        throw new ApiError(400, 'INVALID_WEIGHING', 'El peso bruto debe ser mayor que la tara.');
      }
      const dispatch = this.findPreparing(id);
      dispatch.departureWeighing = {
        ...weighing,
        netKg: Math.round((weighing.grossKg - weighing.tareKg) * 1000) / 1000,
        weighedAt: new Date().toISOString(),
      };
      this.save();
      return toDispatch(dispatch);
    });
  }

  override depart(id: string): Observable<Dispatch> {
    return this.respond(() => {
      const dispatch = this.findDispatch(id);
      if (dispatch.status === 'IN_TRANSIT') {
        return toDispatch(dispatch);
      }
      if (dispatch.status !== 'PREPARING') {
        throw new ApiError(409, 'INVALID_DISPATCH_TRANSITION', 'El despacho ya no puede salir.');
      }
      if (!dispatch.carrier || !dispatch.departureWeighing) {
        throw new ApiError(
          409,
          'DISPATCH_NOT_READY',
          'Registra el transportista y el pesaje de salida antes de despachar.',
        );
      }
      dispatch.status = 'IN_TRANSIT';
      dispatch.departedAt = new Date().toISOString();
      this.save();
      return toDispatch(dispatch);
    });
  }

  override getManifest(id: string): Observable<DispatchManifest> {
    return forkJoin([
      this.getDispatch(id),
      this.organization.listWarehouses().pipe(catchError(() => of([]))),
      this.organization.listWorksites().pipe(catchError(() => of([]))),
    ]).pipe(
      map(([dispatch, warehouses, worksites]) => {
        const warehouse = warehouses.find((w) => w.id === dispatch.warehouseId);
        const worksite = worksites.find((w) => w.id === dispatch.worksiteId);
        return {
          ...dispatch,
          warehouseName: warehouse?.name ?? 'Almacén (simulado)',
          warehouseAddress: warehouse?.address,
          worksiteName: worksite?.name ?? 'Obra (simulada)',
          worksiteAddress: worksite?.address,
          qrCodePngBase64: renderPseudoQr(dispatch.id),
        };
      }),
    );
  }

  override openReception(dispatchId: string): Observable<Reception> {
    return this.respond(() => {
      const existing = this.store.receptions.find((r) => r.dispatchId === dispatchId);
      if (existing) {
        return structuredClone(existing);
      }
      const dispatch = this.findDispatch(dispatchId);
      if (dispatch.status !== 'IN_TRANSIT') {
        throw new ApiError(409, 'DISPATCH_NOT_IN_TRANSIT', 'El despacho no está en tránsito.');
      }
      const reception: Reception = {
        id: generateUuid(),
        dispatchId,
        status: 'IN_PROGRESS',
        confirmedAt: null,
        lines: dispatch.lines.map((line) => ({
          id: generateUuid(),
          dispatchLineId: line.id,
          materialId: line.materialId,
          sku: line.sku,
          materialName: line.materialName,
          unit: line.unit,
          dispatchedQty: line.quantity,
          receivedQty: null,
        })),
      };
      this.store.receptions.push(reception);
      this.save();
      return structuredClone(reception);
    });
  }

  override saveReceptionLine(
    receptionId: string,
    lineId: string,
    receivedQty: number,
    _onRetry?: RetryObserver,
  ): Observable<unknown> {
    return this.respond(() => {
      const reception = this.findReception(receptionId);
      if (reception.status !== 'IN_PROGRESS') {
        throw new ApiError(409, 'RECEPTION_CONFIRMED', 'La recepción ya fue confirmada.');
      }
      if (!(receivedQty >= 0)) {
        throw new ApiError(400, 'INVALID_QUANTITY', 'La cantidad recibida no puede ser negativa.');
      }
      const line = reception.lines.find((l) => l.id === lineId);
      if (!line) {
        throw new ApiError(404, 'NOT_FOUND', 'No se encontró la línea de recepción.');
      }
      line.receivedQty = receivedQty;
      this.save();
      return structuredClone(line);
    });
  }

  override getComparison(receptionId: string): Observable<ComparisonRow[]> {
    return this.respond(() => {
      const reception = this.findReception(receptionId);
      const dispatch = this.findDispatch(reception.dispatchId);
      return reception.lines.map((line): ComparisonRow => {
        const dispatchLine = dispatch.lines.find((d) => d.id === line.dispatchLineId);
        const tolerance = dispatchLine?.tolerancePercent ?? 0;
        const {difference, shrinkagePercent} = computeShrinkage(line.dispatchedQty, line.receivedQty);
        return {
          materialId: line.materialId,
          sku: line.sku,
          materialName: line.materialName,
          unit: line.unit,
          requested: dispatchLine?.requested ?? line.dispatchedQty,
          dispatched: line.dispatchedQty,
          received: line.receivedQty,
          difference,
          shrinkagePercent,
          withinTolerance: line.receivedQty !== null && Math.abs(shrinkagePercent) <= tolerance,
          tolerancePercent: tolerance,
        };
      });
    });
  }

  override confirmReception(receptionId: string): Observable<Reception> {
    return this.respond(() => {
      const reception = this.findReception(receptionId);
      if (reception.status === 'CONFIRMED') {
        return structuredClone(reception);
      }
      if (reception.lines.some((l) => l.receivedQty === null)) {
        throw new ApiError(409, 'RECEPTION_INCOMPLETE', 'Registra la cantidad recibida de cada material.');
      }
      reception.status = 'CONFIRMED';
      reception.confirmedAt = new Date().toISOString();
      this.findDispatch(reception.dispatchId).status = 'RECEIVED';
      this.save();
      return structuredClone(reception);
    });
  }

  private respond<T>(work: () => T): Observable<T> {
    return defer(() => {
      try {
        return of(work());
      } catch (error) {
        return throwError(() => error);
      }
    }).pipe(delay(LATENCY_MS));
  }

  private fail<T>(status: number, code: string, message: string): Observable<T> {
    return throwError(() => new ApiError(status, code, message));
  }

  private findDispatch(id: string): MockDispatch {
    const dispatch = this.store.dispatches.find((d) => d.id === id);
    if (!dispatch) {
      throw new ApiError(404, 'NOT_FOUND', 'No se encontró el despacho.');
    }
    return dispatch;
  }

  private findPreparing(id: string): MockDispatch {
    const dispatch = this.findDispatch(id);
    if (dispatch.status !== 'PREPARING') {
      throw new ApiError(409, 'INVALID_DISPATCH_TRANSITION', 'El despacho ya salió del almacén.');
    }
    return dispatch;
  }

  private findReception(id: string): Reception {
    const reception = this.store.receptions.find((r) => r.id === id);
    if (!reception) {
      throw new ApiError(404, 'NOT_FOUND', 'No se encontró la recepción.');
    }
    return reception;
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
    } catch {
      // Sin almacenamiento: la simulación dura lo que la pestaña.
    }
  }
}

function toDispatch(dispatch: MockDispatch): Dispatch {
  return {
    ...structuredClone(dispatch),
    lines: dispatch.lines.map(({requested: _r, tolerancePercent: _t, ...line}) => ({...line})),
  };
}

function nextCode(count: number): string {
  return `DSP-${String(count + 1).padStart(5, '0')}`;
}

function loadStore(): MockStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MockStore;
      if (Array.isArray(parsed.dispatches) && Array.isArray(parsed.receptions)) {
        return parsed;
      }
    }
  } catch {
    // Datos corruptos: se vuelve a sembrar.
  }
  return seedStore();
}

/** Un despacho de demostración en tránsito para probar la recepción sin backend. */
function seedStore(): MockStore {
  const line = (
    sku: string,
    materialName: string,
    unit: string,
    quantity: number,
    requested: number,
    tolerancePercent: number,
  ): MockDispatchLine => ({
    id: generateUuid(),
    orderLineId: generateUuid(),
    materialId: generateUuid(),
    sku,
    materialName,
    unit,
    quantity,
    requested,
    tolerancePercent,
  });
  return {
    receptions: [],
    dispatches: [
      {
        id: generateUuid(),
        code: 'DSP-DEMO1',
        orderId: generateUuid(),
        status: 'IN_TRANSIT',
        carrier: {carrierName: 'Transportes Rímac SAC', carrierDocument: '20512345678', plate: 'ABC-123'},
        departureWeighing: {grossKg: 18450, tareKg: 8200, netKg: 10250, weighedAt: new Date().toISOString()},
        createdAt: new Date().toISOString(),
        departedAt: new Date().toISOString(),
        lines: [
          line('CEM-001', 'Cemento Portland tipo I', 'BAG', 200, 200, 2.5),
          line('FIE-012', 'Fierro corrugado 1/2"', 'UNIT', 150, 180, 1),
          line('ARE-003', 'Arena gruesa', 'M3', 12, 12, 5),
        ],
      },
    ],
  };
}

/**
 * Dibuja un patrón con forma de QR (no escaneable) para la vista previa del
 * manifiesto simulado. El backend real devuelve el PNG del QR verdadero.
 */
function renderPseudoQr(seed: string): string {
  const size = 25;
  const scale = 8;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return '';
  }
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const isFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dark: boolean;
      if (isFinder(x, y)) {
        const fx = x < 7 ? x : x - (size - 7);
        const fy = y < 7 ? y : y - (size - 7);
        const ring = Math.max(Math.abs(fx - 3), Math.abs(fy - 3));
        dark = ring !== 2;
      } else {
        hash = (hash * 1103515245 + 12345) >>> 0;
        dark = (hash >>> 16) % 2 === 0;
      }
      if (dark) {
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }
  return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
}
