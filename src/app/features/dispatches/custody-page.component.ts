import {DatePipe} from '@angular/common';
import {Component, OnInit, computed, inject, input, signal} from '@angular/core';
import {RouterLink} from '@angular/router';

import {LogisticsApi} from '../../core/api/logistics-api';
import {AuthService} from '../../core/auth/auth.service';
import {toApiError} from '../../core/http/api-error';
import {Custody, CustodyEvent} from '../../core/models/logistics';
import {IconComponent} from '../../shared/icon.component';

/** Tono del hito en la línea de tiempo según su tipo. */
export function custodyTone(type: string): 'ok' | 'bad' | 'warn' | 'info' | 'plain' {
  switch (type) {
    case 'RECEIVED':
    case 'DISCREPANCY_RESOLVED':
    case 'DISCREPANCY_ACCEPTED':
      return 'ok';
    case 'CANCELLED':
    case 'DISCREPANCY_OPENED':
    case 'DISCREPANCY_ESCALATED':
      return 'bad';
    case 'INCIDENT':
    case 'PARTIALLY_RECEIVED':
      return 'warn';
    case 'DEPARTED':
    case 'RECEPTION_OPENED':
    case 'ARRIVAL_WEIGHED':
    case 'DISCREPANCY_RESPONDED':
      return 'info';
    default:
      return 'plain';
  }
}

/** US39: historial de custodia del despacho, de la preparación al cierre de discrepancias. */
@Component({
  selector: 'app-custody-page',
  standalone: true,
  imports: [RouterLink, DatePipe, IconComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <p class="eyebrow muted">Historial de custodia</p>
          <h1 class="code-title">{{ custody()?.manifestCode ?? 'Despacho' }}</h1>
        </div>
        <div class="actions">
          <a class="btn btn-ghost" [routerLink]="backLink()">
            <app-icon name="back" />
            {{ isWarehouse() ? 'Volver al despacho' : 'Despachos en camino' }}
          </a>
        </div>
      </div>
      <p class="lead">Quién tuvo el material y qué pasó en cada momento, del almacén a la obra.</p>

      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }

      @if (custody(); as c) {
        @if (c.events.length) {
          <ol class="list-plain timeline" aria-label="Eventos de custodia">
            @for (event of c.events; track $index) {
              <li [class]="'tone-' + tone(event.type)" [attr.data-type]="event.type">
                <span class="dot" aria-hidden="true"></span>
                <div class="body">
                  <time class="when" [attr.datetime]="event.at">{{ event.at | date: 'dd/MM/yyyy HH:mm' }}</time>
                  <strong class="label">{{ event.label }}</strong>
                  @if (event.detail) {
                    <span class="detail">{{ event.detail }}</span>
                  }
                  <span class="actor muted">{{ actor(event) }}</span>
                </div>
              </li>
            }
          </ol>
        } @else {
          <div class="empty">
            <strong>Sin eventos todavía</strong>
            <p>Cuando el despacho avance, aquí quedará cada paso con su responsable, fecha y hora.</p>
          </div>
        }
      } @else if (!error()) {
        <p class="loading">Cargando historial…</p>
      }
    </section>
  `,
  styles: `
    .timeline {
      position: relative;
      display: grid;
      gap: 0;
      max-width: 720px;
    }
    li {
      position: relative;
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr);
      gap: 12px;
      padding-bottom: 20px;
    }
    li:not(:last-child)::before {
      content: '';
      position: absolute;
      left: 13px;
      top: 22px;
      bottom: 0;
      width: 2px;
      background: var(--bs-junta);
    }
    .dot {
      width: 16px;
      height: 16px;
      margin: 4px 0 0 6px;
      border-radius: 50%;
      border: 3px solid var(--bs-asfalto);
      background: var(--bs-losa);
    }
    .tone-ok .dot { border-color: var(--bs-conforme); background: var(--bs-conforme-bg); }
    .tone-bad .dot { border-color: var(--bs-merma); background: var(--bs-merma-bg); }
    .tone-warn .dot { border-color: var(--bs-senal); background: var(--bs-pendiente-bg); }
    .tone-info .dot { border-color: var(--bs-transito); background: var(--bs-transito-bg); }
    .body {
      display: grid;
      gap: 2px;
      padding: 12px 16px;
      background: var(--bs-losa);
      border: 1px solid var(--bs-junta);
      border-radius: var(--bs-radius);
    }
    .when,
    .actor {
      font-size: 0.8125rem;
      font-variant-numeric: tabular-nums;
    }
    .when {
      color: var(--bs-acero);
    }
    .label {
      font-size: 1.05rem;
    }
  `,
})
export class CustodyPageComponent implements OnInit {
  /** Parámetro :id de la ruta. */
  readonly id = input.required<string>();

  private readonly logistics = inject(LogisticsApi);
  private readonly auth = inject(AuthService);

  protected readonly custody = signal<Custody | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly tone = custodyTone;
  protected readonly isWarehouse = computed(() => this.auth.hasAnyRole(['ADMINISTRATOR', 'WAREHOUSE_MANAGER']));
  protected readonly backLink = computed(() => (this.isWarehouse() ? ['/dispatches', this.id()] : ['/reception']));

  ngOnInit(): void {
    this.logistics.getCustody(this.id()).subscribe({
      next: (custody) => this.custody.set(custody),
      error: (err: unknown) => this.error.set(toApiError(err).message),
    });
  }

  protected actor(event: CustodyEvent): string {
    return event.actorName ? `Responsable: ${event.actorName}` : 'Registrado por el sistema';
  }
}
