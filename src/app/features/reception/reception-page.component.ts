import {Component, DestroyRef, OnInit, computed, inject, input, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {Subscription} from 'rxjs';

import {LogisticsApi, computeShrinkage} from '../../core/api/logistics-api';
import {shouldReuseIdempotencyKey, toApiError} from '../../core/http/api-error';
import {ComparisonRow, Reception} from '../../core/models/logistics';
import {generateUuid} from '../../core/util/uuid';
import {ReceptionComparisonComponent} from './reception-comparison.component';
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
 */
@Component({
  selector: 'app-reception-page',
  standalone: true,
  imports: [RouterLink, ReceptionComparisonComponent],
  templateUrl: './reception-page.component.html',
  styleUrl: './reception-page.component.scss',
})
export class ReceptionPageComponent implements OnInit {
  /** Parámetro :dispatchId de la ruta. */
  readonly dispatchId = input.required<string>();

  private readonly logistics = inject(LogisticsApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly reception = signal<Reception | null>(null);
  private readonly comparison = signal<ComparisonRow[]>([]);
  private readonly local = signal<Record<string, LocalLine>>({});
  private readonly inFlight = new Map<string, Subscription>();
  private comparisonSub: Subscription | null = null;

  protected readonly error = signal<string | null>(null);
  protected readonly confirming = signal(false);
  protected readonly confirmed = computed(() => this.reception()?.status === 'CONFIRMED');

  /** Se reusa si el usuario vuelve a confirmar tras un error de red. */
  private confirmKey = generateUuid();

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
  protected readonly savingCount = computed(
    () => this.rows().filter((r) => r.saveState !== 'saved').length,
  );

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => {
      this.inFlight.forEach((sub) => sub.unsubscribe());
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

  private saveLine(lineId: string, receivedQty: number): void {
    const reception = this.reception();
    if (!reception || this.confirmed()) {
      return;
    }
    this.inFlight.get(lineId)?.unsubscribe();
    this.setLine(lineId, {received: receivedQty, state: 'saving'});
    const sub = this.logistics
      .saveReceptionLine(reception.id, lineId, receivedQty, () =>
        this.setLine(lineId, {received: receivedQty, state: 'retrying'}),
      )
      .subscribe({
        next: () => {
          this.inFlight.delete(lineId);
          this.setLine(lineId, {received: receivedQty, state: 'saved'});
          this.refreshComparison();
        },
        error: (err: unknown) => {
          this.inFlight.delete(lineId);
          this.setLine(lineId, {received: receivedQty, state: 'error'});
          this.error.set(toApiError(err).message);
        },
      });
    this.inFlight.set(lineId, sub);
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
    if (!reception || this.inFlight.size > 0) {
      return;
    }
    this.comparisonSub?.unsubscribe();
    this.comparisonSub = this.logistics.getComparison(reception.id).subscribe({
      next: (comparison) => this.comparison.set(comparison.lines),
      error: (err: unknown) => this.error.set(toApiError(err).message),
    });
  }
}
