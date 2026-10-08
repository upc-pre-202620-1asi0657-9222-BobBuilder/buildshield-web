import {DatePipe} from '@angular/common';
import {Component, DestroyRef, LOCALE_ID, OnInit, computed, inject, input, signal} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {Subscription, retry, throwError, timer} from 'rxjs';

import {LogisticsApi, computeShrinkage} from '../../core/api/logistics-api';
import {ApiError, shouldReuseIdempotencyKey, toApiError} from '../../core/http/api-error';
import {CLOSED_DISCREPANCY_STATUSES, Discrepancy, discrepancyTypeLabel} from '../../core/models/discrepancy';
import {ArrivalWeighing, ComparisonRow, Reception} from '../../core/models/logistics';
import {generateUuid} from '../../core/util/uuid';
import {IconComponent} from '../../shared/icon.component';
import {ArrivalWeighingComponent} from './arrival-weighing.component';
import {ReceptionComparisonComponent} from './reception-comparison.component';
import {ReportDiscrepancyComponent, ReportableMaterial} from './report-discrepancy.component';
import {LineSaveState, ReceivedChange, ReceptionLineView} from './reception-models';

interface LocalLine {
  received: number | null;
  state: LineSaveState;
}

/**
 * T37 (paso 2 de 2): recepción en obra, pensada para el celular.
 *
 * Flujo estándar (RNF20, como máximo 5 interacciones): 1) tocar el despacho en
 * la lista, 2) revisar la comparación (las cantidades recibidas vienen
 * precargadas con lo despachado y se guardan solas), 3) tocar «Confirmar
 * recepción». Si algo llegó distinto, se corrige la cantidad de esa línea y se
 * guarda al salir del campo. El botón de confirmar queda fijo abajo, al
 * alcance del pulgar (RNF21).
 *
 * Sprint 3: pesaje de llegada (US29), «Guardar recepción parcial» (US38) y,
 * tras confirmar, aviso con las discrepancias abiertas (US36).
 */
@Component({
  selector: 'app-reception-page',
  standalone: true,
  imports: [
    RouterLink,
    ReceptionComparisonComponent,
    ArrivalWeighingComponent,
    ReportDiscrepancyComponent,
    IconComponent,
  ],
  templateUrl: './reception-page.component.html',
  styleUrl: './reception-page.component.scss',
})
export class ReceptionPageComponent implements OnInit {
  /** Parámetro :dispatchId de la ruta. */
  readonly dispatchId = input.required<string>();

  private readonly logistics = inject(LogisticsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly datePipe = new DatePipe(inject(LOCALE_ID));

  protected readonly reception = signal<Reception | null>(null);
  private readonly comparison = signal<ComparisonRow[]>([]);
  private readonly local = signal<Record<string, LocalLine>>({});
  private readonly queue: Array<{lineId: string; receivedQty: number}> = [];
  private current: Subscription | null = null;
  private comparisonSub: Subscription | null = null;

  protected readonly error = signal<string | null>(null);
  protected readonly confirming = signal(false);
  protected readonly savingPartial = signal(false);
  protected readonly notice = signal<string | null>(null);
  /** Discrepancias del despacho, cargadas al confirmar. */
  protected readonly discrepancies = signal<Discrepancy[] | null>(null);
  protected readonly openDiscrepancies = computed(() =>
    (this.discrepancies() ?? []).filter((d) => !CLOSED_DISCREPANCY_STATUSES.includes(d.status)),
  );
  protected readonly discrepancyType = discrepancyTypeLabel;
  protected readonly confirmed = computed(() => this.reception()?.status === 'CONFIRMED');

  /** Se reusa si el usuario vuelve a confirmar tras un error de red. */
  private confirmKey = generateUuid();
  private partialKey = generateUuid();

  protected readonly rows = computed<ReceptionLineView[]>(() => {
    const reception = this.reception();
    if (!reception) {
      return [];
    }
    const byLine = new Map(this.comparison().map((row) => [row.lineId, row]));
    const local = this.local();
    return reception.lines.map((line) => {
      const state = local[line.id] ?? {received: line.receivedQty, state: 'pending'};
      const server = byLine.get(line.id);
      const base = {
        lineId: line.id,
        materialId: line.materialId,
        sku: server?.sku ?? '…',
        materialName: server?.materialName,
        unit: server?.unit,
        requested: server?.requested ?? line.dispatchedQty,
        dispatched: line.dispatchedQty,
        received: state.received,
        tolerancePercent: server?.tolerancePercent,
        saveState: state.state,
      };
      // El backend manda cuando su cotejo ya refleja lo guardado.
      if (server && state.state === 'saved' && server.received === state.received && server.difference !== null) {
        return {
          ...base,
          difference: server.difference,
          shrinkagePercent: server.shrinkagePercent ?? 0,
          withinTolerance: server.withinTolerance,
        };
      }
      const {difference, shrinkagePercent} = computeShrinkage(line.dispatchedQty, state.received);
      const tolerance = server?.tolerancePercent;
      return {
        ...base,
        difference,
        shrinkagePercent,
        withinTolerance:
          tolerance !== undefined && state.received !== null ? shrinkagePercent <= tolerance : null,
      };
    });
  });

  protected readonly allSaved = computed(
    () => this.rows().length > 0 && this.rows().every((r) => r.saveState === 'saved'),
  );
  protected readonly reportableMaterials = computed<ReportableMaterial[]>(() =>
    this.rows().map((r) => ({materialId: r.materialId, sku: r.sku, materialName: r.materialName})),
  );

  protected readonly savingCount = computed(
    () => this.rows().filter((r) => r.saveState !== 'saved').length,
  );

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => {
      this.current?.unsubscribe();
      this.comparisonSub?.unsubscribe();
    });
    this.logistics.openReception(this.dispatchId()).subscribe({
      next: (reception) => this.start(reception),
      error: (err: unknown) => this.error.set(toApiError(err).message),
    });
  }

  protected onReceivedChange(change: ReceivedChange): void {
    this.saveLine(change.lineId, change.receivedQty);
  }

  protected confirm(): void {
    const reception = this.reception();
    if (!reception || !this.allSaved()) {
      return;
    }
    this.confirming.set(true);
    this.error.set(null);
    this.logistics.confirmReception(reception.id, this.confirmKey).subscribe({
      next: (confirmed) => {
        this.confirming.set(false);
        this.reception.set({...confirmed, status: 'CONFIRMED'});
        this.refreshComparison();
        this.loadDiscrepancies();
      },
      error: (err: unknown) => {
        const apiError = toApiError(err);
        this.confirming.set(false);
        this.error.set(apiError.message);
        if (!shouldReuseIdempotencyKey(apiError)) {
          this.confirmKey = generateUuid();
        }
      },
    });
  }

  /** US38: registra lo recibido hasta ahora; el despacho sigue abierto. */
  protected savePartial(): void {
    const reception = this.reception();
    if (!reception || !this.allSaved()) {
      return;
    }
    this.savingPartial.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.logistics.savePartialReception(reception.id, this.partialKey).subscribe({
      next: (saved) => {
        this.savingPartial.set(false);
        this.partialKey = generateUuid();
        this.reception.set({...reception, ...saved, lines: saved.lines?.length ? saved.lines : reception.lines});
        this.notice.set(
          'Recepción parcial guardada: lo recibido ya suma al stock de la obra. Vuelve cuando llegue el resto para confirmar.',
        );
      },
      error: (err: unknown) => {
        const apiError = toApiError(err);
        this.savingPartial.set(false);
        this.error.set(apiError.message);
        if (!shouldReuseIdempotencyKey(apiError)) {
          this.partialKey = generateUuid();
        }
      },
    });
  }

  protected onArrivalWeighed(weighing: ArrivalWeighing): void {
    this.reception.update((r) => (r ? {...r, arrivalWeighing: weighing} : r));
  }

  protected onDiscrepancyCreated(discrepancy: Discrepancy): void {
    void this.router.navigate(['/discrepancies', discrepancy.id]);
  }

  /** Texto del aviso de recepción parcial. */
  protected partialSummary(r: Reception): string {
    const count = r.partialCount ?? 0;
    const times = count === 1 ? '1 vez' : `${count} veces`;
    const last = r.lastPartialAt ? `, la última el ${this.datePipe.transform(r.lastPartialAt, 'dd/MM HH:mm')}` : '';
    return `Recepción parcial guardada ${times}${last}. Las cantidades ya ingresadas no pueden bajar.`;
  }

  private loadDiscrepancies(): void {
    this.logistics.listDiscrepancies({dispatchId: this.dispatchId()}).subscribe({
      next: (list) => this.discrepancies.set(list),
      error: () => this.discrepancies.set([]),
    });
  }

  private start(reception: Reception): void {
    this.reception.set(reception);
    const initial: Record<string, LocalLine> = {};
    for (const line of reception.lines) {
      initial[line.id] = {
        received: line.receivedQty ?? line.dispatchedQty,
        state: line.receivedQty === null ? 'pending' : 'saved',
      };
    }
    this.local.set(initial);
    this.loadComparison(reception.id);
    if (reception.status === 'CONFIRMED') {
      this.refreshComparison();
      this.loadDiscrepancies();
      return;
    }
    // Precarga: lo no registrado se guarda con lo despachado (caso estándar sin diferencias).
    const pending = reception.lines.filter((l) => l.receivedQty === null);
    if (pending.length === 0) {
      this.refreshComparison();
    }
    for (const line of pending) {
      this.saveLine(line.id, line.dispatchedQty);
    }
  }

  /**
   * Encola el guardado de una línea. Los PUT se envían de a uno: el backend
   * bloquea la recepción completa en cada cambio y dos PUT simultáneos de
   * líneas distintas chocan con 409 CONCURRENT_MODIFICATION.
   */
  private saveLine(lineId: string, receivedQty: number): void {
    if (!this.reception() || this.confirmed()) {
      return;
    }
    const index = this.queue.findIndex((item) => item.lineId === lineId);
    if (index >= 0) {
      this.queue.splice(index, 1);
    }
    this.queue.push({lineId, receivedQty});
    this.setLine(lineId, {received: receivedQty, state: 'pending'});
    this.pump();
  }

  private pump(): void {
    const reception = this.reception();
    if (!reception || this.current || this.queue.length === 0) {
      return;
    }
    const {lineId, receivedQty} = this.queue.shift()!;
    this.setLine(lineId, {received: receivedQty, state: 'saving'});
    const markRetrying = () => this.setLine(lineId, {received: receivedQty, state: 'retrying'});
    this.current = this.logistics
      .saveReceptionLine(reception.id, lineId, receivedQty, markRetrying)
      .pipe(
        retry({
          count: 2,
          delay: (error: unknown) => {
            if (error instanceof ApiError && error.code === 'CONCURRENT_MODIFICATION') {
              markRetrying();
              return timer(300);
            }
            return throwError(() => error);
          },
        }),
      )
      .subscribe({
        next: () => this.finishLine(lineId, receivedQty, 'saved'),
        error: (err: unknown) => {
          this.error.set(toApiError(err).message);
          this.finishLine(lineId, receivedQty, 'error');
        },
      });
  }

  private finishLine(lineId: string, receivedQty: number, state: LineSaveState): void {
    this.current = null;
    // Si el usuario cambió la línea mientras se guardaba, queda pendiente el valor nuevo.
    if (!this.queue.some((item) => item.lineId === lineId)) {
      this.setLine(lineId, {received: receivedQty, state});
    }
    if (this.queue.length === 0) {
      this.refreshComparison();
    }
    this.pump();
  }

  private setLine(lineId: string, value: LocalLine): void {
    this.local.update((all) => ({...all, [lineId]: value}));
  }

  private loadComparison(receptionId: string): void {
    this.logistics.getComparison(receptionId).subscribe({
      next: (comparison) => {
        if (this.comparison().length === 0) {
          this.comparison.set(comparison.lines);
        }
      },
    });
  }

  private refreshComparison(): void {
    const reception = this.reception();
    if (!reception || this.current || this.queue.length > 0) {
      return;
    }
    this.comparisonSub?.unsubscribe();
    this.comparisonSub = this.logistics.getComparison(reception.id).subscribe({
      next: (comparison) => this.comparison.set(comparison.lines),
      error: (err: unknown) => this.error.set(toApiError(err).message),
    });
  }
}
