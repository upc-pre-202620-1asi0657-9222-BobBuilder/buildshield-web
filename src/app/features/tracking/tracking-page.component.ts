import {DatePipe} from '@angular/common';
import {Component, DestroyRef, OnInit, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {catchError, forkJoin, interval, of} from 'rxjs';

import {LogisticsApi} from '../../core/api/logistics-api';
import {OrganizationApiService} from '../../core/api/organization-api.service';
import {toApiError} from '../../core/http/api-error';
import {Dispatch} from '../../core/models/logistics';
import {Worksite} from '../../core/models/organization';
import {IconComponent} from '../../shared/icon.component';
import {nameIndex} from '../../shared/status';
import {elapsedSince} from '../../shared/time';

/** Cada cuánto se recalcula el tiempo en ruta en pantalla. */
const CLOCK_MS = 60_000;

/** US31: despachos en tránsito con tiempo desde la salida, incidencias y obra destino. */
@Component({
  selector: 'app-tracking-page',
  standalone: true,
  imports: [RouterLink, DatePipe, IconComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <h1>En ruta</h1>
        <div class="actions">
          <button class="btn" type="button" (click)="load()" [disabled]="loading()">
            <app-icon name="refresh" />
            {{ loading() ? 'Actualizando…' : 'Actualizar' }}
          </button>
        </div>
      </div>
      <p class="lead">Despachos que salieron del almacén y todavía no se reciben en obra, del que lleva más tiempo al más reciente.</p>

      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }

      @if (loading() && dispatches().length === 0) {
        <p class="loading">Buscando despachos en ruta…</p>
      } @else if (dispatches().length) {
        <div class="card">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Obra destino</th>
                  <th>Salida</th>
                  <th>En ruta</th>
                  <th class="num">Incidencias</th>
                  <th><span class="visually-hidden">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                @for (d of dispatches(); track d.id) {
                  <tr [attr.data-dispatch]="d.id">
                    <td data-label="Código" class="code">{{ d.manifestCode }}</td>
                    <td data-label="Obra destino">{{ worksiteNames().get(d.worksiteId) ?? '-' }}</td>
                    <td data-label="Salida">{{ d.departedAt | date: 'dd/MM HH:mm' }}</td>
                    <td data-label="En ruta" class="elapsed">
                      <app-icon name="clock" />
                      {{ elapsed(d.departedAt) }}
                    </td>
                    <td data-label="Incidencias" class="num incidents">
                      @if (d.incidentCount) {
                        <span class="badge badge-warn">{{ d.incidentCount }}</span>
                      } @else {
                        <span class="muted">0</span>
                      }
                    </td>
                    <td data-label="" class="row-actions">
                      <a class="btn" [routerLink]="['/dispatches', d.id]">Ver despacho</a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else {
        <div class="empty">
          <strong>Nada en ruta</strong>
          <p>Cuando un despacho salga del almacén, aparecerá aquí hasta que la obra lo reciba.</p>
          <a class="btn" routerLink="/dispatches">
            <app-icon name="truck" />
            Ir a despachos
          </a>
        </div>
      }
    </section>
  `,
  styles: `
    .elapsed {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .elapsed app-icon {
      width: 16px;
      height: 16px;
      vertical-align: -3px;
      color: var(--bs-transito);
    }
  `,
})
export class TrackingPageComponent implements OnInit {
  private readonly logistics = inject(LogisticsApi);
  private readonly orgApi = inject(OrganizationApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly dispatches = signal<Dispatch[]>([]);
  protected readonly worksiteNames = signal(new Map<string, string>());
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly now = signal(Date.now());

  ngOnInit(): void {
    const clock = interval(CLOCK_MS).subscribe(() => this.now.set(Date.now()));
    this.destroyRef.onDestroy(() => clock.unsubscribe());
    this.load();
  }

  protected elapsed(departedAt: string | null): string {
    return elapsedSince(departedAt, this.now());
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      dispatches: this.logistics.listDispatches({status: 'IN_TRANSIT'}),
      worksites: this.orgApi.listWorksites().pipe(catchError(() => of([] as Worksite[]))),
    }).subscribe({
      next: ({dispatches, worksites}) => {
        this.now.set(Date.now());
        this.dispatches.set(
          dispatches
            .filter((d) => d.status === 'IN_TRANSIT')
            .sort((a, b) => (a.departedAt ?? '').localeCompare(b.departedAt ?? '')),
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
