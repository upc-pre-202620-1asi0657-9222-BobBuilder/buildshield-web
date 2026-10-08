import {Injectable, inject} from '@angular/core';
import {Observable, catchError, defer, delay, forkJoin, map, of, switchMap, throwError} from 'rxjs';

import {ApiError} from '../http/api-error';
import {RetryObserver} from '../http/http-context';
import {
  CLOSED_DISCREPANCY_STATUSES,
  CreateDiscrepancyRequest,
  DISCREPANCY_STATUS_LABELS,
  DISCREPANCY_TYPE_LABELS,
  Discrepancy,
  DiscrepancyFilter,
  DiscrepancyStatus,
  DiscrepancyType,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MIME_TYPES,
  Evidence,
} from '../models/discrepancy';
import {
  ArrivalWeighing,
  CarrierRequest,
  Comparison,
  ComparisonRow,
  CreateDispatchRequest,
  Custody,
  CustodyEvent,
  Dispatch,
  DispatchManifest,
  INCIDENT_TYPE_LABELS,
  IncidentRequest,
  Reception,
  TransitIncident,
  WeighingRequest,
} from '../models/logistics';
import {Material} from '../models/organization';
import {generateUuid} from '../util/uuid';
import {DispatchFilter, LogisticsApi, computeShrinkage} from './logistics-api';
import {OrganizationApiService} from './organization-api.service';
import {OrdersApiService} from './orders-api.service';

const STORAGE_KEY = 'buildshield.mock.logistics';
const LATENCY_MS = 250;

/** Datos de material que el backend real resuelve por su cuenta. */
interface MaterialInfo {
  materialId: string;
  sku: string;
  name: string;
  unit: string;
  requested: number;
  tolerancePercent: number;
}

interface MockStore {
  dispatches: Dispatch[];
  receptions: Reception[];
  materials: MaterialInfo[];
  sites: Array<{id: string; name: string; address: string}>;
  // Sprint 3
  incidents: TransitIncident[];
  discrepancies: Discrepancy[];
  /** Cantidad ya ingresada al stock por línea de recepción en parciales. */
  partials: Record<string, number>;
}

const DEMO_USER = 'Usuario demo';

/**
 * Simulación en memoria (persistida en localStorage) de los endpoints de
 * despachos y recepciones del Sprint 2, con las mismas formas que
 * buildshield-core 1.1.0. Se activa con environment.mockSprint2; sirve para
 * demos sin backend.
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
        .map((d) => structuredClone(d)),
    );
  }

  override getDispatch(id: string): Observable<Dispatch> {
    return this.respond(() => structuredClone(this.findDispatch(id)));
  }

  override createDispatch(request: CreateDispatchRequest): Observable<Dispatch> {
    const materials$ = this.organization
      .listMaterials()
      .pipe(catchError(() => of([] as Material[])));
    return forkJoin([this.orders.get(request.orderId), materials$]).pipe(
      switchMap(([order, materials]) =>
        this.respond(() => {
          if (request.lines.length === 0) {
            throw new ApiError(400, 'DISPATCH_WITHOUT_LINES', 'El despacho debe tener al menos una línea.');
          }
          const lines = request.lines.map((requested) => {
            const orderLine = order.lines.find((l) => (l.id ?? l.materialId) === requested.orderLineId);
            if (!orderLine) {
              throw new ApiError(400, 'MATERIAL_NOT_IN_ORDER', 'La línea no pertenece al pedido.');
            }
            if (requested.quantity <= 0 || requested.quantity > orderLine.pending) {
              throw new ApiError(409, 'DISPATCH_EXCEEDS_PENDING', `La cantidad de ${orderLine.sku} supera lo pendiente.`);
            }
            const material = materials.find((m) => m.id === orderLine.materialId);
            this.rememberMaterial({
              materialId: orderLine.materialId,
              sku: orderLine.sku,
              name: material?.name ?? orderLine.sku,
              unit: orderLine.unit,
              requested: orderLine.requested,
              tolerancePercent: Number(material?.wasteTolerancePercent ?? 0),
            });
            return {
              id: generateUuid(),
              orderLineId: requested.orderLineId,
              materialId: orderLine.materialId,
              quantity: requested.quantity,
            };
          });
          const complete = request.lines.every((r) => {
            const l = order.lines.find((o) => (o.id ?? o.materialId) === r.orderLineId);
            return l !== undefined && r.quantity === l.pending;
          });
          const dispatch: Dispatch = {
            id: generateUuid(),
            orderId: order.id,
            warehouseId: order.warehouseId,
            worksiteId: order.worksiteId,
            type: complete ? 'COMPLETE' : 'PARTIAL',
            status: 'PREPARED',
            manifestCode: manifestCode(),
            preparedAt: new Date().toISOString(),
            departedAt: null,
            receivedAt: null,
            carrier: null,
            departureWeighing: null,
            lines,
          };
          this.store.dispatches.unshift(dispatch);
          this.save();
          return structuredClone(dispatch);
        }),
      ),
    );
  }

  override setCarrier(id: string, carrier: CarrierRequest): Observable<Dispatch> {
    return this.respond(() => {
      const dispatch = this.findPrepared(id);
      dispatch.carrier = {name: carrier.carrierName, document: carrier.carrierDocument, plate: carrier.plate};
      this.save();
      return structuredClone(dispatch);
    });
  }

  override registerDepartureWeighing(id: string, weighing: WeighingRequest): Observable<Dispatch> {
    return this.respond(() => {
      if (weighing.grossKg <= weighing.tareKg) {
        throw new ApiError(400, 'INVALID_WEIGHING', 'El peso bruto debe ser mayor que la tara.');
      }
      const dispatch = this.findPrepared(id);
      dispatch.departureWeighing = {
        ...weighing,
        netKg: Math.round((weighing.grossKg - weighing.tareKg) * 1000) / 1000,
        weighedAt: new Date().toISOString(),
      };
      this.save();
      return structuredClone(dispatch);
    });
  }

  override depart(id: string): Observable<Dispatch> {
    return this.respond(() => {
      const dispatch = this.findPrepared(id);
      if (!dispatch.carrier || !dispatch.departureWeighing) {
        throw new ApiError(409, 'DISPATCH_NOT_READY', 'Registra el transportista y el pesaje de salida antes de despachar.');
      }
      dispatch.status = 'IN_TRANSIT';
      dispatch.departedAt = new Date().toISOString();
      this.save();
      return structuredClone(dispatch);
    });
  }

  override getManifest(id: string): Observable<DispatchManifest> {
    return forkJoin([
      this.getDispatch(id),
      this.organization.listWarehouses().pipe(catchError(() => of([]))),
      this.organization.listWorksites().pipe(catchError(() => of([]))),
    ]).pipe(
      map(([d, warehouses, worksites]) => {
        const site = (id: string, list: Array<{id: string; name: string; address: string}>, fallback: string) =>
          list.find((s) => s.id === id) ??
          this.store.sites.find((s) => s.id === id) ?? {id, name: fallback, address: ''};
        return {
          manifestCode: d.manifestCode,
          dispatchId: d.id,
          status: d.status,
          type: d.type,
          preparedAt: d.preparedAt,
          departedAt: d.departedAt,
          order: {id: d.orderId, placedAt: d.preparedAt},
          warehouse: site(d.warehouseId, warehouses, 'Almacén (simulado)'),
          worksite: site(d.worksiteId, worksites, 'Obra (simulada)'),
          lines: d.lines.map((l) => {
            const info = this.material(l.materialId);
            return {materialId: l.materialId, sku: info.sku, name: info.name, unit: info.unit, quantity: l.quantity};
          }),
          carrier: d.carrier,
          departureWeighing: d.departureWeighing,
          qrContent: d.manifestCode,
          qrCodePngBase64: renderPseudoQr(d.manifestCode),
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
        orderId: dispatch.orderId,
        warehouseId: dispatch.warehouseId,
        worksiteId: dispatch.worksiteId,
        status: 'IN_PROGRESS',
        confirmedBy: null,
        confirmedAt: null,
        lines: dispatch.lines.map((line) => ({
          id: generateUuid(),
          dispatchLineId: line.id,
          orderLineId: line.orderLineId,
          materialId: line.materialId,
          dispatchedQty: line.quantity,
          receivedQty: null,
          shrinkagePercent: null,
        })),
      };
      this.store.receptions.push(reception);
      this.save();
      return structuredClone(reception);
    });
  }

  override getReception(id: string): Observable<Reception> {
    return this.respond(() => structuredClone(this.findReception(id)));
  }

  override saveReceptionLine(
    receptionId: string,
    lineId: string,
    receivedQty: number,
    _onRetry?: RetryObserver,
  ): Observable<unknown> {
    return this.respond(() => {
      const reception = this.findReception(receptionId);
      if (reception.status === 'CONFIRMED') {
        throw new ApiError(409, 'RECEPTION_CONFIRMED', 'La recepción ya fue confirmada.');
      }
      const line = reception.lines.find((l) => l.id === lineId);
      if (!line) {
        throw new ApiError(404, 'NOT_FOUND', 'No se encontró la línea de recepción.');
      }
      if (receivedQty < (this.store.partials[lineId] ?? 0)) {
        throw new ApiError(
          409,
          'RECEIVED_BELOW_PARTIAL',
          'La cantidad no puede ser menor a lo ya ingresado en una recepción parcial.',
        );
      }
      line.receivedQty = receivedQty;
      line.shrinkagePercent = computeShrinkage(line.dispatchedQty, receivedQty).shrinkagePercent;
      this.save();
      return structuredClone(reception);
    });
  }

  override getComparison(receptionId: string): Observable<Comparison> {
    return this.respond(() => {
      const reception = this.findReception(receptionId);
      const lines = reception.lines.map((line): ComparisonRow => {
        const info = this.material(line.materialId);
        const {difference, shrinkagePercent} = computeShrinkage(line.dispatchedQty, line.receivedQty);
        const recorded = line.receivedQty !== null;
        return {
          lineId: line.id,
          materialId: line.materialId,
          sku: info.sku,
          materialName: info.name,
          unit: info.unit,
          requested: info.requested,
          dispatched: line.dispatchedQty,
          received: line.receivedQty,
          difference: recorded ? difference : null,
          shrinkagePercent: recorded ? shrinkagePercent : null,
          tolerancePercent: info.tolerancePercent,
          withinTolerance: recorded ? shrinkagePercent <= info.tolerancePercent : null,
        };
      });
      return {
        receptionId,
        dispatchId: reception.dispatchId,
        orderId: reception.orderId,
        status: reception.status,
        complete: lines.every((l) => l.received !== null),
        withinTolerance: lines.every((l) => l.withinTolerance !== false),
        lines,
      };
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
      const dispatch = this.findDispatch(reception.dispatchId);
      dispatch.status = 'RECEIVED';
      dispatch.receivedAt = reception.confirmedAt;
      this.openAutomaticDiscrepancies(reception, dispatch);
      this.save();
      return structuredClone(reception);
    });
  }

  // Sprint 3: despacho -------------------------------------------------------

  override cancelDispatch(id: string, reason: string): Observable<Dispatch> {
    return this.respond(() => {
      const dispatch = this.findPrepared(id);
      requireText(reason, 3, 300, 'El motivo debe tener de 3 a 300 caracteres.');
      dispatch.status = 'CANCELLED';
      dispatch.cancelledAt = new Date().toISOString();
      dispatch.cancellationReason = reason.trim();
      this.save();
      return structuredClone(dispatch);
    });
  }

  override registerIncident(dispatchId: string, incident: IncidentRequest): Observable<TransitIncident> {
    return this.respond(() => {
      const dispatch = this.findDispatch(dispatchId);
      if (dispatch.status !== 'IN_TRANSIT') {
        throw new ApiError(409, 'DISPATCH_NOT_IN_TRANSIT', 'Solo se registran incidencias de despachos en tránsito.');
      }
      requireText(incident.observation, 3, 500, 'La observación debe tener de 3 a 500 caracteres.');
      const created: TransitIncident = {
        id: generateUuid(),
        dispatchId,
        type: incident.type,
        typeLabel: INCIDENT_TYPE_LABELS[incident.type],
        observation: incident.observation.trim(),
        reportedBy: DEMO_USER,
        reportedAt: new Date().toISOString(),
      };
      this.store.incidents.push(created);
      dispatch.incidentCount = this.store.incidents.filter((i) => i.dispatchId === dispatchId).length;
      this.save();
      return structuredClone(created);
    });
  }

  override listIncidents(dispatchId: string): Observable<TransitIncident[]> {
    return this.respond(() =>
      this.store.incidents
        .filter((i) => i.dispatchId === dispatchId)
        .sort((a, b) => a.reportedAt.localeCompare(b.reportedAt))
        .map((i) => structuredClone(i)),
    );
  }

  override getDispatchByManifest(code: string): Observable<Dispatch> {
    return this.respond(() => {
      const wanted = code.trim().toUpperCase();
      const dispatch = this.store.dispatches.find((d) => d.manifestCode.toUpperCase() === wanted);
      if (!dispatch) {
        throw new ApiError(404, 'NOT_FOUND', 'No se encontró un despacho con ese código.');
      }
      return structuredClone(dispatch);
    });
  }

  override getCustody(dispatchId: string): Observable<Custody> {
    return this.respond(() => {
      const d = this.findDispatch(dispatchId);
      const events: CustodyEvent[] = [];
      const add = (at: string | null | undefined, type: string, label: string, detail: string | null = null) => {
        if (at) {
          events.push({at, type, label, actorId: null, actorName: DEMO_USER, detail});
        }
      };
      add(d.preparedAt, 'PREPARED', 'Despacho preparado');
      if (d.carrier) {
        add(d.preparedAt, 'CARRIER_ASSIGNED', 'Transportista asignado', `${d.carrier.name}, placa ${d.carrier.plate}`);
      }
      if (d.departureWeighing) {
        add(
          d.departureWeighing.weighedAt ?? d.preparedAt,
          'DEPARTURE_WEIGHED',
          'Pesaje de salida',
          `Neto ${d.departureWeighing.netKg} kg`,
        );
      }
      add(d.departedAt, 'DEPARTED', 'Salida del almacén');
      for (const incident of this.store.incidents.filter((i) => i.dispatchId === d.id)) {
        add(incident.reportedAt, 'INCIDENT', `Incidencia: ${incident.typeLabel ?? incident.type}`, incident.observation);
      }
      add(d.cancelledAt, 'CANCELLED', 'Despacho anulado', d.cancellationReason ?? null);
      const reception = this.store.receptions.find((r) => r.dispatchId === d.id);
      if (reception) {
        add(d.departedAt, 'RECEPTION_OPENED', 'Recepción abierta en obra');
        if (reception.arrivalWeighing) {
          add(reception.lastPartialAt ?? reception.confirmedAt ?? d.departedAt, 'ARRIVAL_WEIGHED', 'Pesaje de llegada',
            `Neto ${reception.arrivalWeighing.netKg} kg`);
        }
        add(reception.lastPartialAt, 'PARTIALLY_RECEIVED', 'Recepción parcial registrada');
        add(reception.confirmedAt, 'RECEIVED', 'Recepción confirmada');
      }
      for (const disc of this.store.discrepancies.filter((x) => x.dispatchId === d.id)) {
        add(disc.openedAt, 'DISCREPANCY_OPENED', `Discrepancia abierta: ${disc.sku}`, disc.observation);
        add(disc.response?.at, 'DISCREPANCY_RESPONDED', 'Discrepancia respondida', disc.response?.text ?? null);
        add(disc.escalation?.at, 'DISCREPANCY_ESCALATED', 'Discrepancia escalada', disc.escalation?.reason ?? null);
        add(disc.resolution?.at, 'DISCREPANCY_RESOLVED', 'Discrepancia resuelta', disc.resolution?.decision ?? null);
        if (disc.status === 'ACCEPTED') {
          add(disc.response?.at, 'DISCREPANCY_ACCEPTED', 'Respuesta aceptada por la obra');
        }
      }
      events.sort((a, b) => a.at.localeCompare(b.at));
      return {dispatchId: d.id, manifestCode: d.manifestCode, events};
    });
  }

  // Sprint 3: recepción ------------------------------------------------------

  override openReceptionByManifest(manifestCode: string): Observable<Reception> {
    return this.getDispatchByManifest(manifestCode).pipe(switchMap((d) => this.openReception(d.id)));
  }

  override savePartialReception(receptionId: string): Observable<Reception> {
    return this.respond(() => {
      const reception = this.findReception(receptionId);
      if (reception.status === 'CONFIRMED') {
        throw new ApiError(409, 'RECEPTION_CONFIRMED', 'La recepción ya fue confirmada.');
      }
      for (const line of reception.lines) {
        this.store.partials[line.id] = line.receivedQty ?? 0;
      }
      reception.status = 'PARTIALLY_RECEIVED';
      reception.partialCount = (reception.partialCount ?? 0) + 1;
      reception.lastPartialAt = new Date().toISOString();
      this.save();
      return structuredClone(reception);
    });
  }

  override registerArrivalWeighing(receptionId: string, weighing: WeighingRequest): Observable<ArrivalWeighing> {
    return this.respond(() => {
      if (weighing.grossKg <= weighing.tareKg) {
        throw new ApiError(400, 'INVALID_WEIGHING', 'El peso bruto debe ser mayor que la tara.');
      }
      const reception = this.findReception(receptionId);
      if (reception.arrivalWeighing) {
        throw new ApiError(409, 'ARRIVAL_WEIGHING_ALREADY_RECORDED', 'El pesaje de llegada ya fue registrado.');
      }
      const dispatch = this.findDispatch(reception.dispatchId);
      const netKg = round3(weighing.grossKg - weighing.tareKg);
      const departureNetKg = dispatch.departureWeighing?.netKg ?? null;
      const tolerances = reception.lines.map((l) => this.material(l.materialId).tolerancePercent);
      const tolerancePercent = tolerances.length ? Math.min(...tolerances) : 0;
      const differenceKg = departureNetKg === null ? null : round3(departureNetKg - netKg);
      const differencePercent =
        departureNetKg === null || differenceKg === null || departureNetKg === 0
          ? null
          : Math.round((differenceKg / departureNetKg) * 10000) / 100;
      const result: ArrivalWeighing = {
        grossKg: weighing.grossKg,
        tareKg: weighing.tareKg,
        netKg,
        departureNetKg,
        differenceKg,
        differencePercent,
        tolerancePercent,
        withinTolerance: differencePercent === null ? null : Math.abs(differencePercent) <= tolerancePercent,
        ticketPhotoUrl: weighing.ticketPhotoUrl ?? null,
      };
      reception.arrivalWeighing = result;
      this.save();
      return structuredClone(result);
    });
  }

  // Sprint 3: discrepancias --------------------------------------------------

  override listDiscrepancies(filter: DiscrepancyFilter = {}): Observable<Discrepancy[]> {
    return this.respond(() =>
      this.store.discrepancies
        .filter((d) => !filter.status || d.status === filter.status)
        .filter((d) => !filter.worksiteId || d.worksiteId === filter.worksiteId)
        .filter((d) => !filter.dispatchId || d.dispatchId === filter.dispatchId)
        .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
        .map((d) => structuredClone(d)),
    );
  }

  override getDiscrepancy(id: string): Observable<Discrepancy> {
    return this.respond(() => structuredClone(this.findDiscrepancy(id)));
  }

  override createDiscrepancy(request: CreateDiscrepancyRequest): Observable<Discrepancy> {
    return this.respond(() => {
      const reception = this.findReception(request.receptionId);
      const duplicate = this.store.discrepancies.some(
        (d) =>
          d.receptionId === request.receptionId &&
          d.materialId === request.materialId &&
          d.type === request.type &&
          !CLOSED_DISCREPANCY_STATUSES.includes(d.status),
      );
      if (duplicate) {
        throw new ApiError(409, 'DISCREPANCY_ALREADY_OPEN', 'Ya hay una discrepancia abierta de ese tipo para el material.');
      }
      const created = this.newDiscrepancy(reception, request.materialId, request.type, request.quantity, null, request.observation);
      this.store.discrepancies.unshift(created);
      this.save();
      return structuredClone(created);
    });
  }

  override uploadEvidence(discrepancyId: string, file: File): Observable<Evidence> {
    return this.respond(() => {
      const discrepancy = this.findDiscrepancy(discrepancyId);
      if (!EVIDENCE_MIME_TYPES.includes(file.type) || file.size > EVIDENCE_MAX_BYTES) {
        throw new ApiError(400, 'INVALID_EVIDENCE', 'La foto debe ser JPG, PNG o WEBP de hasta 5 MB.');
      }
      const evidence: Evidence = {
        id: generateUuid(),
        // Solo vive mientras la pestaña esté abierta: la simulación no guarda archivos.
        url: URL.createObjectURL(file),
        fileName: file.name,
        uploadedBy: DEMO_USER,
        uploadedAt: new Date().toISOString(),
      };
      discrepancy.evidences.push(evidence);
      this.save();
      return structuredClone(evidence);
    });
  }

  override respondDiscrepancy(id: string, text: string): Observable<Discrepancy> {
    return this.transition(id, 'OPEN', 'RESPONDED', (d, at) => (d.response = {text: text.trim(), by: DEMO_USER, at}));
  }

  override acceptDiscrepancy(id: string): Observable<Discrepancy> {
    return this.transition(id, 'RESPONDED', 'ACCEPTED', () => undefined);
  }

  override escalateDiscrepancy(id: string, reason: string): Observable<Discrepancy> {
    return this.transition(id, 'RESPONDED', 'ESCALATED', (d, at) => (d.escalation = {reason: reason.trim(), by: DEMO_USER, at}));
  }

  override resolveDiscrepancy(id: string, decision: string): Observable<Discrepancy> {
    return this.transition(id, 'ESCALATED', 'RESOLVED', (d, at) => (d.resolution = {decision: decision.trim(), by: DEMO_USER, at}));
  }

  private transition(
    id: string,
    from: DiscrepancyStatus,
    to: DiscrepancyStatus,
    apply: (d: Discrepancy, at: string) => void,
  ): Observable<Discrepancy> {
    return this.respond(() => {
      const discrepancy = this.findDiscrepancy(id);
      if (discrepancy.status !== from) {
        throw new ApiError(409, 'INVALID_DISCREPANCY_TRANSITION', 'La discrepancia ya no está en un estado que permita esa acción.');
      }
      apply(discrepancy, new Date().toISOString());
      discrepancy.status = to;
      discrepancy.statusLabel = DISCREPANCY_STATUS_LABELS[to];
      this.save();
      return structuredClone(discrepancy);
    });
  }

  /** Al confirmar: una discrepancia por línea fuera de tolerancia, sin duplicados. */
  private openAutomaticDiscrepancies(reception: Reception, dispatch: Dispatch): void {
    for (const line of reception.lines) {
      const info = this.material(line.materialId);
      const received = line.receivedQty ?? 0;
      const {difference, shrinkagePercent} = computeShrinkage(line.dispatchedQty, received);
      if (Math.abs(shrinkagePercent) <= info.tolerancePercent) {
        continue;
      }
      const type: DiscrepancyType = received > line.dispatchedQty ? 'EXCESS' : 'SHORTAGE';
      const exists = this.store.discrepancies.some(
        (d) => d.receptionId === reception.id && d.materialId === line.materialId && d.type === type,
      );
      if (!exists) {
        const created = this.newDiscrepancy(reception, line.materialId, type, Math.abs(difference), shrinkagePercent, null);
        created.manifestCode = dispatch.manifestCode;
        this.store.discrepancies.unshift(created);
      }
    }
  }

  private newDiscrepancy(
    reception: Reception,
    materialId: string,
    type: DiscrepancyType,
    quantity: number,
    shrinkagePercent: number | null,
    observation: string | null,
  ): Discrepancy {
    const info = this.material(materialId);
    const dispatch = this.store.dispatches.find((d) => d.id === reception.dispatchId);
    return {
      id: generateUuid(),
      organizationId: 'org-demo',
      receptionId: reception.id,
      dispatchId: reception.dispatchId,
      manifestCode: dispatch?.manifestCode ?? '',
      worksiteId: reception.worksiteId,
      warehouseId: reception.warehouseId,
      materialId,
      sku: info.sku,
      materialName: info.name,
      type,
      typeLabel: DISCREPANCY_TYPE_LABELS[type],
      quantity,
      shrinkagePercent,
      tolerancePercent: info.tolerancePercent,
      observation,
      status: 'OPEN',
      statusLabel: DISCREPANCY_STATUS_LABELS.OPEN,
      openedBy: DEMO_USER,
      openedAt: new Date().toISOString(),
      response: null,
      escalation: null,
      resolution: null,
      evidences: [],
    };
  }

  private findDiscrepancy(id: string): Discrepancy {
    const discrepancy = this.store.discrepancies.find((d) => d.id === id);
    if (!discrepancy) {
      throw new ApiError(404, 'NOT_FOUND', 'No se encontró la discrepancia.');
    }
    return discrepancy;
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

  private rememberMaterial(info: MaterialInfo): void {
    this.store.materials = [...this.store.materials.filter((m) => m.materialId !== info.materialId), info];
  }

  private material(materialId: string): MaterialInfo {
    return (
      this.store.materials.find((m) => m.materialId === materialId) ?? {
        materialId,
        sku: materialId.slice(0, 8),
        name: 'Material',
        unit: '',
        requested: 0,
        tolerancePercent: 0,
      }
    );
  }

  private findDispatch(id: string): Dispatch {
    const dispatch = this.store.dispatches.find((d) => d.id === id);
    if (!dispatch) {
      throw new ApiError(404, 'NOT_FOUND', 'No se encontró el despacho.');
    }
    return dispatch;
  }

  private findPrepared(id: string): Dispatch {
    const dispatch = this.findDispatch(id);
    if (dispatch.status !== 'PREPARED') {
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

function manifestCode(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `MAN-${date}-${generateUuid().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

function loadStore(): MockStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MockStore;
      if (Array.isArray(parsed.dispatches) && Array.isArray(parsed.materials)) {
        // Datos guardados por la simulación del Sprint 2: se completan los del Sprint 3.
        return {
          ...parsed,
          incidents: parsed.incidents ?? [],
          discrepancies: parsed.discrepancies ?? [],
          partials: parsed.partials ?? {},
        };
      }
    }
  } catch {
    // Datos corruptos: se vuelve a sembrar.
  }
  return seedStore();
}

/** Un despacho de demostración en tránsito para probar la recepción sin backend. */
function seedStore(): MockStore {
  const materials: MaterialInfo[] = [
    {materialId: generateUuid(), sku: 'CEM-001', name: 'Cemento Portland tipo I', unit: 'BAG', requested: 200, tolerancePercent: 2.5},
    {materialId: generateUuid(), sku: 'FIE-012', name: 'Fierro corrugado 1/2"', unit: 'UNIT', requested: 180, tolerancePercent: 1},
    {materialId: generateUuid(), sku: 'ARE-003', name: 'Arena gruesa', unit: 'M3', requested: 12, tolerancePercent: 5},
  ];
  const quantities = [200, 150, 12];
  const warehouse = {id: generateUuid(), name: 'Almacén Central (demo)', address: 'Av. Argentina 2500, Callao'};
  const worksite = {id: generateUuid(), name: 'Torre Norte (demo)', address: 'Av. Principal 100, Miraflores'};
  const now = new Date().toISOString();
  return {
    materials,
    sites: [warehouse, worksite],
    receptions: [],
    incidents: [],
    discrepancies: [],
    partials: {},
    dispatches: [
      {
        id: generateUuid(),
        orderId: generateUuid(),
        warehouseId: warehouse.id,
        worksiteId: worksite.id,
        type: 'PARTIAL',
        status: 'IN_TRANSIT',
        manifestCode: 'MAN-DEMO-0001',
        preparedAt: now,
        departedAt: now,
        receivedAt: null,
        carrier: {name: 'Transportes Rímac SAC', document: '20512345678', plate: 'ABC-123'},
        departureWeighing: {grossKg: 18450, tareKg: 8200, netKg: 10250, weighedAt: now},
        lines: materials.map((m, i) => ({
          id: generateUuid(),
          orderLineId: generateUuid(),
          materialId: m.materialId,
          quantity: quantities[i],
        })),
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
        dark = Math.max(Math.abs(fx - 3), Math.abs(fy - 3)) !== 2;
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

function requireText(value: string, min: number, max: number, message: string): void {
  const length = (value ?? '').trim().length;
  if (length < min || length > max) {
    throw new ApiError(400, 'VALIDATION_ERROR', message);
  }
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
