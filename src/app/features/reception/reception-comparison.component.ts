import {DecimalPipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, computed, input, output} from '@angular/core';

import {
  LineSaveState,
  ReceivedChange,
  ReceptionLineView,
  SAVE_STATE_LABELS,
} from './reception-models';

/**
 * T37: tabla de comparación solicitado / despachado / recibido por material,
 * con merma, badge de tolerancia y estado de guardado de cada línea. En
 * pantallas angostas cada fila se muestra como tarjeta (estilos globales).
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
