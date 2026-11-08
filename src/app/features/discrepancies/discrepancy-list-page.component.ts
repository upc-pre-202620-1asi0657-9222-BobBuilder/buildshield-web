import {DatePipe, DecimalPipe} from '@angular/common';
import {Component, OnInit, computed, inject, input, signal} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {catchError, forkJoin, of} from 'rxjs';

import {LogisticsApi} from '../../core/api/logistics-api';
import {OrganizationApiService} from '../../core/api/organization-api.service';
import {toApiError} from '../../core/http/api-error';
import {
  DISCREPANCY_STATUSES,
  DISCREPANCY_STATUS_LABELS,
  Discrepancy,
  discrepancyStatusLabel,
  discrepancyTypeLabel,
} from '../../core/models/discrepancy';
import {Worksite} from '../../core/models/organization';
import {IconComponent} from '../../shared/icon.component';
import {nameIndex, statusBadgeClass} from '../../shared/status';

/**
 * US36: discrepancias por estado. El backend filtra por rol (obra: sus obras;
 * almacén: sus almacenes; administrador: todas).
 */
@Component({
  selector: 'app-discrepancy-list-page',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, IconComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <h1>Discrepancias</h1>
        <div class="actions">
          <button class="btn" type="button" (click)="load()" [disabled]="loading()">
            <app-icon name="refresh" />
            {{ loading() ? 'Actualizando…' : 'Actualizar' }}
          </button>
        </div>
      </div>
      <p class="lead">Diferencias entre lo despachado y lo recibido: la obra las abre, el almacén responde y el administrador decide si se escalan.</p>

      <div class="filters" role="group" aria-label="Filtrar por estado">
        <button type="button" class="chip" [class.on]="!status()" [attr.aria-pressed]="!status()" (click)="setStatus(undefined)">
          Todas
        </button>
        @for (s of statuses; track s) {
          <button type="button" class="chip" [class.on]="status() === s" [attr.aria-pressed]="status() === s" (click)="setStatus(s)">
            {{ statusLabels[s] }}
          </button>
        }
      </div>

      @if (dispatchId()) {
        <p class="muted scope">
          Mostrando un solo despacho.
          <a routerLink="/discrepancies" [queryParams]="{status: status() ?? null}">Ver todas</a>
        </p>
      }

      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }

      @if (loading() && items().length === 0) {
        <p class="loading">Cargando discrepancias…</p>
      } @else if (items().length) {
        <div class="card">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Tipo</th>
                  <th class="num">Cantidad</th>
                  <th>Obra</th>
                  <th>Manifiesto</th>
                  <th>Abierta</th>
                  <th>Estado</th>
                  <th><span class="visually-hidden">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                @for (d of items(); track d.id) {
                  <tr [attr.data-discrepancy]="d.id">
                    <td data-label="Material"><span class="code">{{ d.sku }}</span> {{ d.materialName }}</td>
                    <td data-label="Tipo">{{ typeLabel(d) }}</td>
                    <td data-label="Cantidad" class="num">{{ d.quantity | number: '1.0-3' }}</td>
                    <td data-label="Obra">{{ worksiteNames().get(d.worksiteId) ?? '-' }}</td>
                    <td data-label="Manifiesto" class="code">{{ d.manifestCode || '-' }}</td>
                    <td data-label="Abierta">{{ d.openedAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                    <td data-label="Estado"><span [class]="'badge ' + badge(d.status)">{{ statusLabel(d) }}</span></td>
                    <td data-label="" class="row-actions">
                      <a class="btn" [routerLink]="['/discrepancies', d.id]">Abrir</a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else {
        <div class="empty">
          <strong>{{ status() ? 'Nada en este estado' : 'Sin discrepancias' }}</strong>
          <p>Cuando una recepción se confirme con materiales fuera de tolerancia, o la obra reporte un daño, aparecerá aquí.</p>
        </div>
      }
    </section>
  `,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .chip {
      min-height: 40px;
      padding: 0 16px;
      border: 1.5px solid var(--bs-junta);
      border-radius: 999px;
      background: var(--bs-losa);
      color: var(--bs-asfalto);
      font: inherit;
      font-weight: 500;
      cursor: pointer;
    }
    .chip:hover {
      border-color: var(--bs-asfalto);
    }
    .chip:focus-visible {
      box-shadow: var(--bs-ring);
      outline: none;
    }
    .chip.on {
      background: var(--bs-asfalto);
      border-color: var(--bs-asfalto);
      color: #fff;
    }
    .scope {
      margin: 0 0 16px;
    }
  `,
})
export class DiscrepancyListPageComponent implements OnInit {
  /** Query params opcionales ?status= y ?dispatchId=. */
  readonly statusParam = input<string | undefined>(undefined, {alias: 'status'});
  readonly dispatchId = input<string | undefined>(undefined);

  private readonly logistics = inject(LogisticsApi);
  private readonly orgApi = inject(OrganizationApiService);
  private readonly router = inject(Router);

  protected readonly statuses = DISCREPANCY_STATUSES;
  protected readonly statusLabels = DISCREPANCY_STATUS_LABELS;
  protected readonly statusLabel = discrepancyStatusLabel;
  protected readonly typeLabel = discrepancyTypeLabel;
  protected readonly badge = statusBadgeClass;

  private readonly selected = signal<string | undefined>(undefined);
  protected readonly status = computed(() => this.selected());
  protected readonly items = signal<Discrepancy[]>([]);
  protected readonly worksiteNames = signal(new Map<string, string>());
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.selected.set(this.statusParam() || undefined);
    this.load();
  }

  protected setStatus(status: string | undefined): void {
    this.selected.set(status);
    void this.router.navigate([], {
      queryParams: {status: status ?? null},
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      items: this.logistics.listDiscrepancies({status: this.selected(), dispatchId: this.dispatchId()}),
      worksites: this.orgApi.listWorksites().pipe(catchError(() => of([] as Worksite[]))),
    }).subscribe({
      next: ({items, worksites}) => {
        this.items.set(items);
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
