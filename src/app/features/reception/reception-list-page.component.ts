import {DatePipe} from '@angular/common';
import {Component, OnInit, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {catchError, forkJoin, of} from 'rxjs';

import {LogisticsApi} from '../../core/api/logistics-api';
import {OrganizationApiService} from '../../core/api/organization-api.service';
import {toApiError} from '../../core/http/api-error';
import {Dispatch} from '../../core/models/logistics';
import {Worksite} from '../../core/models/organization';
import {nameIndex} from '../../shared/status';

/**
 * T37 (paso 1 de 2): despachos en tránsito hacia las obras del encargado.
 * Tocar una tarjeta abre la recepción.
 */
@Component({
  selector: 'app-reception-list-page',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <section class="page">
      <div class="page-header">
        <h1>Despachos en camino</h1>
        <button class="btn" type="button" (click)="load()" [disabled]="loading()">Actualizar</button>
      </div>
      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }
      <ul class="list-plain">
        @for (d of dispatches(); track d.id) {
          <li>
            <a class="dispatch-card" [routerLink]="['/reception', d.id]">
              <span class="code">{{ d.manifestCode }}</span>
              <span class="where">{{ (d.worksiteId && worksiteNames().get(d.worksiteId)) || 'Obra asignada' }}</span>
              <span class="meta">
                {{ d.lines.length }} {{ d.lines.length === 1 ? 'material' : 'materiales' }}
                @if (d.carrier) {
                  · {{ d.carrier.plate }}
                }
                @if (d.departedAt) {
                  · salió {{ d.departedAt | date: 'dd/MM HH:mm' }}
                }
              </span>
              <span class="cta">Recibir</span>
            </a>
          </li>
        } @empty {
          <li class="muted">{{ loading() ? 'Cargando…' : 'No hay despachos en tránsito hacia tus obras.' }}</li>
        }
      </ul>
    </section>
  `,
  styles: `
    .dispatch-card {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 2px 12px;
      min-height: 88px;
      padding: 14px 16px;
      margin-bottom: 12px;
      background: var(--bs-color-surface);
      border: 1px solid var(--bs-color-border);
      border-left: 6px solid var(--bs-color-accent);
      border-radius: var(--bs-radius);
      color: inherit;
      text-decoration: none;
    }
    .code {
      font-weight: 700;
      font-size: 1.1rem;
    }
    .where,
    .meta {
      grid-column: 1;
    }
    .meta {
      font-size: 0.85rem;
      color: var(--bs-color-muted);
    }
    .cta {
      grid-column: 2;
      grid-row: 1 / span 3;
      align-self: center;
      display: inline-flex;
      align-items: center;
      min-height: var(--bs-touch);
      padding: 0 16px;
      border-radius: var(--bs-radius);
      background: var(--bs-color-primary);
      color: #fff;
      font-weight: 600;
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
