import {DatePipe} from '@angular/common';
import {Component, OnInit, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {catchError, forkJoin, of} from 'rxjs';

import {LogisticsApi} from '../../core/api/logistics-api';
import {OrganizationApiService} from '../../core/api/organization-api.service';
import {toApiError} from '../../core/http/api-error';
import {Dispatch} from '../../core/models/logistics';
import {Worksite} from '../../core/models/organization';
import {IconComponent} from '../../shared/icon.component';
import {nameIndex} from '../../shared/status';

/**
 * T37 (paso 1 de 2): despachos en tránsito hacia las obras del encargado.
 * Tocar una tarjeta abre la recepción.
 */
@Component({
  selector: 'app-reception-list-page',
  standalone: true,
  imports: [RouterLink, DatePipe, IconComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <h1>Despachos en camino</h1>
        <div class="actions">
          <button class="btn" type="button" (click)="load()" [disabled]="loading()">
            <app-icon name="refresh" />
            {{ loading() ? 'Actualizando…' : 'Actualizar' }}
          </button>
        </div>
      </div>
      <p class="lead">Elige el camión que llegó a tu obra para registrar lo recibido.</p>

      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }

      @if (loading() && dispatches().length === 0) {
        <p class="loading">Buscando despachos en camino…</p>
      } @else {
        <ul class="list-plain cards">
          @for (d of dispatches(); track d.id) {
            <li>
              <a class="dispatch-card" [routerLink]="['/reception', d.id]">
                <span class="where">{{ (d.worksiteId && worksiteNames().get(d.worksiteId)) || 'Obra asignada' }}</span>
                <span class="code">{{ d.manifestCode }}</span>
                <span class="meta">
                  <span>{{ d.lines.length }} {{ d.lines.length === 1 ? 'material' : 'materiales' }}</span>
                  @if (d.carrier) {
                    <span>Placa {{ d.carrier.plate }}</span>
                  }
                  @if (d.departedAt) {
                    <span>Salió {{ d.departedAt | date: 'dd/MM HH:mm' }}</span>
                  }
                </span>
                <span class="cta">
                  Recibir
                  <app-icon name="reception" />
                </span>
              </a>
            </li>
          } @empty {
            <li class="empty">
              <strong>No hay despachos en camino</strong>
              <p>Cuando el almacén despache materiales a tus obras, aparecerán aquí.</p>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .cards {
      display: grid;
      gap: 12px;
      @media (min-width: 900px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    .dispatch-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 4px 16px;
      height: 100%;
      padding: 16px 16px 16px 20px;
      background: var(--bs-losa);
      border: 1px solid var(--bs-junta);
      border-left: 6px solid var(--bs-transito);
      border-radius: var(--bs-radius);
      color: inherit;
      text-decoration: none;
      transition: border-color 150ms var(--bs-ease), background-color 150ms var(--bs-ease);
    }
    .dispatch-card:hover {
      border-color: var(--bs-asfalto);
      border-left-color: var(--bs-transito);
    }
    .where {
      font-family: var(--bs-font-display);
      font-weight: 800;
      font-size: 1.5rem;
      line-height: 1.1;
    }
    .code {
      font-size: 1rem;
      color: var(--bs-acero);
    }
    .where,
    .code,
    .meta {
      grid-column: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 14px;
      margin-top: 6px;
      font-size: 0.875rem;
      color: var(--bs-acero);
      font-variant-numeric: tabular-nums;
    }
    .cta {
      grid-column: 2;
      grid-row: 1 / span 3;
      align-self: center;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: var(--bs-touch);
      padding: 0 16px;
      border-radius: var(--bs-radius-control);
      background: var(--bs-asfalto);
      color: #fff;
      font-weight: 600;
    }
    .empty {
      grid-column: 1 / -1;
    }
  `,
})
export class ReceptionListPageComponent implements OnInit {
  private readonly logistics = inject(LogisticsApi);
  private readonly orgApi = inject(OrganizationApiService);

  protected readonly dispatches = signal<Dispatch[]>([]);
  protected readonly worksiteNames = signal(new Map<string, string>());
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      dispatches: this.logistics.listDispatches({status: 'IN_TRANSIT'}),
      worksites: this.orgApi.listWorksites().pipe(catchError(() => of([] as Worksite[]))),
    }).subscribe({
      next: ({dispatches, worksites}) => {
        const mine = new Set(worksites.map((w) => w.id));
        // El backend ya filtra por las obras asignadas; aquí se refuerza en el cliente.
        this.dispatches.set(
          dispatches.filter(
            (d) => d.status === 'IN_TRANSIT' && (!d.worksiteId || mine.size === 0 || mine.has(d.worksiteId)),
          ),
        );
        this.worksiteNames.set(nameIndex(worksites));
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }
}
