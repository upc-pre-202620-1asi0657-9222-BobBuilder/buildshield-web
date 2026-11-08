import {DatePipe} from '@angular/common';
import {Component, OnInit, inject, input, output, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';

import {LogisticsApi} from '../../core/api/logistics-api';
import {shouldReuseIdempotencyKey, toApiError} from '../../core/http/api-error';
import {
  INCIDENT_TYPES,
  INCIDENT_TYPE_LABELS,
  IncidentType,
  TransitIncident,
  incidentTypeLabel,
} from '../../core/models/logistics';
import {generateUuid} from '../../core/util/uuid';
import {IconComponent} from '../../shared/icon.component';

export const INCIDENT_OBSERVATION_MIN = 3;
export const INCIDENT_OBSERVATION_MAX = 500;

/** US32: incidencias en ruta. El formulario solo aparece con el despacho en tránsito. */
@Component({
  selector: 'app-dispatch-incidents',
  standalone: true,
  imports: [FormsModule, DatePipe, IconComponent],
  template: `
    <div class="card">
      <h2 class="title">
        Incidencias en ruta
        @if (incidents().length) {
          <span class="badge badge-warn">{{ incidents().length }}</span>
        }
      </h2>

      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }

      @if (incidents().length) {
        <ul class="list-plain incidents">
          @for (incident of incidents(); track incident.id) {
            <li>
              <span class="what">
                <app-icon name="alert" />
                <strong>{{ typeLabel(incident) }}</strong>
                <span class="muted small">{{ incident.reportedAt | date: 'dd/MM HH:mm' }}</span>
              </span>
              <span>{{ incident.observation }}</span>
              <span class="muted small">Registró {{ incident.reportedBy }}</span>
            </li>
          }
        </ul>
      } @else if (!loading()) {
        <p class="muted">Sin incidencias registradas.</p>
      }

      @if (canReport()) {
        <form class="report" (ngSubmit)="report()" novalidate>
          <div class="form-grid">
            <div class="field">
              <label for="incidentType">Tipo de incidencia</label>
              <select id="incidentType" name="type" [(ngModel)]="type">
                @for (t of types; track t) {
                  <option [value]="t">{{ labels[t] }}</option>
                }
              </select>
            </div>
            <div class="field full">
              <label for="incidentObservation">Qué pasó</label>
              <textarea
                id="incidentObservation"
                name="observation"
                rows="2"
                [(ngModel)]="observation"
                [maxlength]="max"
                aria-describedby="incidentHint"
              ></textarea>
              <span class="hint" id="incidentHint">
                De {{ min }} a {{ max }} caracteres. La obra de destino y los administradores reciben un aviso.
              </span>
            </div>
          </div>
          <div class="form-actions">
            <button class="btn" type="submit" [disabled]="busy()">
              <app-icon name="plus" />
              {{ busy() ? 'Registrando…' : 'Registrar incidencia' }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
  styles: `
    .title {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .incidents {
      display: grid;
      gap: 12px;
      margin-bottom: 16px;
    }
    .incidents li {
      display: grid;
      gap: 2px;
      padding: 12px 14px;
      border-left: 4px solid var(--bs-senal);
      background: var(--bs-pendiente-bg);
      border-radius: var(--bs-radius-control);
    }
    .what {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .small {
      font-size: 0.8125rem;
      font-variant-numeric: tabular-nums;
    }
    .report {
      border-top: 1px solid var(--bs-junta-suave);
      padding-top: 16px;
    }
  `,
})
export class DispatchIncidentsComponent implements OnInit {
  readonly dispatchId = input.required<string>();
  /** true solo con el despacho en tránsito (el backend responde 409 en otro estado). */
  readonly canReport = input(false);
  readonly reported = output<TransitIncident>();

  private readonly logistics = inject(LogisticsApi);

  protected readonly types = INCIDENT_TYPES;
  protected readonly labels = INCIDENT_TYPE_LABELS;
  protected readonly typeLabel = incidentTypeLabel;
  protected readonly min = INCIDENT_OBSERVATION_MIN;
  protected readonly max = INCIDENT_OBSERVATION_MAX;

  protected readonly incidents = signal<TransitIncident[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected type: IncidentType = 'DELAY';
  protected observation = '';

  private key = generateUuid();

  ngOnInit(): void {
    this.logistics.listIncidents(this.dispatchId()).subscribe({
      next: (list) => {
        this.incidents.set(list);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }

  protected report(): void {
    const observation = this.observation.trim();
    if (observation.length < INCIDENT_OBSERVATION_MIN || observation.length > INCIDENT_OBSERVATION_MAX) {
      this.error.set(
        `Describe la incidencia, de ${INCIDENT_OBSERVATION_MIN} a ${INCIDENT_OBSERVATION_MAX} caracteres.`,
      );
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.logistics.registerIncident(this.dispatchId(), {type: this.type, observation}, this.key).subscribe({
      next: (incident) => {
        this.busy.set(false);
        this.key = generateUuid();
        this.observation = '';
        this.incidents.update((list) => [...list, incident]);
        this.reported.emit(incident);
      },
      error: (err: unknown) => {
        const apiError = toApiError(err);
        this.busy.set(false);
        this.error.set(apiError.message);
        if (!shouldReuseIdempotencyKey(apiError)) {
          this.key = generateUuid();
        }
      },
    });
  }
}
