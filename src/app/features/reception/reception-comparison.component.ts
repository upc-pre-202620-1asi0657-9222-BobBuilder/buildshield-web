import {DecimalPipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, computed, input, output} from '@angular/core';

import {
  LineSaveState,
  ReceivedChange,
  ReceptionLineView,
  SAVE_STATE_LABELS,
} from './reception-models';

/**
 * T37: comparación solicitado / despachado / recibido por material, con el
 * medidor de merma frente a la tolerancia y el estado de guardado de cada línea.
 */
@Component({
  selector: 'app-reception-comparison',
  standalone: true,
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reception-comparison.component.html',
  styleUrl: './reception-comparison.component.scss',
})
export class ReceptionComparisonComponent {
  readonly rows = input.required<readonly ReceptionLineView[]>();
  readonly locked = input(false);

  /** Emite cuando el usuario confirma una cantidad recibida (o reintenta guardarla). */
  readonly receivedChange = output<ReceivedChange>();

  protected readonly outOfTolerance = computed(
    () => this.rows().filter((r) => r.withinTolerance === false).length,
  );

  protected readonly evaluated = computed(
    () => this.rows().filter((r) => r.withinTolerance !== null).length,
  );

  protected clampPct(value: number): number {
    return Math.min(100, Math.max(0, value));
  }

  /** Porcentaje de lo despachado que llegó; sin dato, se asume completo. */
  protected fillPercent(row: ReceptionLineView): number {
    if (row.dispatched <= 0) {
      return 0;
    }
    const received = row.received ?? row.dispatched;
    return this.clampPct((received / row.dispatched) * 100);
  }

  protected stateLabel(state: LineSaveState): string {
    return SAVE_STATE_LABELS[state];
  }

  protected onInput(row: ReceptionLineView, raw: string): void {
    const value = Number(String(raw).replace(',', '.'));
    if (raw === '' || !Number.isFinite(value) || value < 0) {
      return;
    }
    if (value === row.received && row.saveState === 'saved') {
      return;
    }
    this.receivedChange.emit({lineId: row.lineId, receivedQty: value});
  }

  protected retry(row: ReceptionLineView): void {
    if (row.received !== null) {
      this.receivedChange.emit({lineId: row.lineId, receivedQty: row.received});
    }
  }
}
