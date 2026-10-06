import {DatePipe} from '@angular/common';
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';

interface TrackStep {
  readonly key: string;
  readonly label: string;
  readonly at: string | null;
  readonly state: 'done' | 'current' | 'next';
}

const ORDER = ['PREPARED', 'IN_TRANSIT', 'RECEIVED'];

/**
 * Recorrido del despacho: Preparado, En tránsito, Recibido. Es la única
 * secuencia real del sistema, por eso es la única lista numerada.
 */
@Component({
  selector: 'app-dispatch-track',
  standalone: true,
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="track" aria-label="Recorrido del despacho">
      @for (step of steps(); track step.key; let i = $index) {
        <li [class]="step.state" [attr.aria-current]="step.state === 'current' ? 'step' : null">
          <span class="dot" aria-hidden="true">
            @if (step.state === 'done') {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
                stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            } @else {
              {{ i + 1 }}
            }
          </span>
          <span class="text">
            <span class="label">{{ step.label }}</span>
            <span class="at">
              @if (step.at) {
                {{ step.at | date: 'dd/MM HH:mm' }}
              } @else if (step.state === 'current') {
                Siguiente paso
              } @else {
                Pendiente
              }
            </span>
          </span>
        </li>
      }
    </ol>
  `,
  styles: `
    .track {
      list-style: none;
      margin: 0 0 20px;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      counter-reset: none;
    }
    li {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-right: 8px;
    }
    li:not(:last-child)::after {
      content: '';
      position: absolute;
      top: 17px;
      left: 40px;
      right: 4px;
      height: 3px;
      border-radius: 2px;
      background: var(--bs-junta);
    }
    li.done:not(:last-child)::after {
      background: var(--bs-asfalto);
    }
    .dot {
      position: relative;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 2px solid var(--bs-junta);
      background: var(--bs-losa);
      color: var(--bs-acero);
      font-weight: 600;
      font-size: 0.95rem;
    }
    .dot svg {
      width: 18px;
      height: 18px;
    }
    .done .dot {
      background: var(--bs-asfalto);
      border-color: var(--bs-asfalto);
      color: var(--bs-senal);
    }
    .current .dot {
      border-color: var(--bs-asfalto);
      color: var(--bs-asfalto);
      box-shadow: 0 0 0 4px var(--bs-pendiente-bg);
    }
    .text {
      display: flex;
      flex-direction: column;
    }
    .label {
      font-weight: 600;
    }
    .next .label {
      color: var(--bs-acero);
    }
    .at {
      font-size: 0.8125rem;
      color: var(--bs-acero);
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class DispatchTrackComponent {
  readonly status = input.required<string>();
  readonly preparedAt = input<string | null>(null);
  readonly departedAt = input<string | null>(null);
  readonly receivedAt = input<string | null>(null);

  protected readonly steps = computed<TrackStep[]>(() => {
    const index = ORDER.indexOf(this.status());
    const at = [this.preparedAt(), this.departedAt(), this.receivedAt()];
    const labels = ['Preparado', 'En tránsito', 'Recibido'];
    return ORDER.map((key, i) => ({
      key,
      label: labels[i],
      at: at[i],
      // Lo alcanzado está hecho; el paso siguiente es el que toca ahora.
      state: i <= index ? 'done' : i === index + 1 ? 'current' : 'next',
    }));
  });
}
