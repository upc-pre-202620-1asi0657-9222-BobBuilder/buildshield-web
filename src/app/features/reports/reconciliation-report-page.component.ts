import {DatePipe, DecimalPipe} from '@angular/common';
import {Component, OnInit, computed, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';

import {OrganizationApiService} from '../../core/api/organization-api.service';
import {ReportsApiService} from '../../core/api/reports-api.service';
import {AuthService} from '../../core/auth/auth.service';
import {toApiError} from '../../core/http/api-error';
import {Warehouse, Worksite} from '../../core/models/organization';
import {
  ExportFormat,
  PENDING_CASE_LABELS,
  PendingCase,
  ReconciliationReport,
  ReportQuery,
  TOLERANCE_STATUS_LABELS,
  ToleranceStatus,
} from '../../core/models/report';
import {FileSaver} from '../../core/util/file-saver';
import {IconComponent} from '../../shared/icon.component';

export function toleranceBadge(status: ToleranceStatus): string {
  switch (status) {
    case 'WITHIN':
      return 'badge-ok';
    case 'EXCEEDED':
      return 'badge-bad';
    default:
      return 'badge-warn';
  }
}

/**
 * T79 y T80 (US47 y US48): reporte de conciliación entre lo despachado y lo
 * recibido, con merma frente a la tolerancia, totales por unidad, casos
 * pendientes y descarga en CSV y PDF. Cada rol ve su alcance.
 */
@Component({
  selector: 'app-reconciliation-report-page',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, DecimalPipe, RouterLink, IconComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <h1>Conciliación</h1>
        <div class="actions">
          <button class="btn" type="button" [disabled]="!report() || downloading() !== null" (click)="download('csv')" data-testid="export-csv">
            <app-icon name="download" />
            {{ downloading() === 'csv' ? 'Descargando…' : 'Descargar CSV' }}
          </button>
          <button class="btn" type="button" [disabled]="!report() || downloading() !== null" (click)="download('pdf')" data-testid="export-pdf">
            <app-icon name="download" />
            {{ downloading() === 'pdf' ? 'Descargando…' : 'Descargar PDF' }}
          </button>
        </div>
      </div>
      <p class="lead">{{ lead() }}</p>

      <form class="card" [formGroup]="filters" (ngSubmit)="search()" novalidate>
        <div class="filter-grid">
          <div class="field">
            <label for="rep-worksite">Obra</label>
            <select id="rep-worksite" formControlName="worksiteId">
              <option value="">Todas</option>
              @for (w of worksites(); track w.id) {
                <option [value]="w.id">{{ w.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label for="rep-warehouse">Almacén</label>
            <select id="rep-warehouse" formControlName="warehouseId">
              <option value="">Todos</option>
              @for (w of warehouses(); track w.id) {
                <option [value]="w.id">{{ w.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label for="rep-from">Desde</label>
            <input id="rep-from" type="date" formControlName="from" />
          </div>
          <div class="field">
            <label for="rep-to">Hasta</label>
            <input id="rep-to" type="date" formControlName="to" />
          </div>
          <div class="field">
            <button class="btn btn-primary" type="submit" [disabled]="loading()">
              <app-icon name="report" />
              Consultar
            </button>
          </div>
        </div>
        <p class="hint muted">El periodo se compara con la salida del almacén, en días de Lima, con ambas fechas incluidas.</p>
      </form>

      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }
      @if (loading()) {
        <p class="loading">Armando el reporte…</p>
      } @else if (report()) {
        @if (report(); as r) {
        <dl class="kv summary" data-testid="report-summary">
          <div><dt>Despachos</dt><dd>{{ r.summary.dispatchCount }}</dd></div>
          <div><dt>Recepciones pendientes</dt><dd>{{ r.summary.pendingReceptions }}</dd></div>
          <div><dt>Materiales que superan la tolerancia</dt><dd [class.bad]="r.summary.rowsExceedingTolerance > 0">{{ r.summary.rowsExceedingTolerance }}</dd></div>
          <div><dt>Discrepancias abiertas</dt><dd>{{ r.summary.openDiscrepancies }}</dd></div>
        </dl>

        @if (r.rows.length) {
          <div class="card">
            <h2>Por obra, almacén y material</h2>
            <div class="table-wrap">
              <table class="table" data-testid="report-rows">
                <thead>
                  <tr>
                    <th>Obra</th>
                    <th>Almacén</th>
                    <th>Material</th>
                    <th class="num">Despachos</th>
                    <th class="num">Despachado</th>
                    <th class="num">Recibido</th>
                    <th class="num">Por recibir</th>
                    <th class="num">Merma</th>
                    <th class="num">Merma %</th>
                    <th class="num">Tolerancia</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of r.rows; track row.worksiteId + row.warehouseId + row.materialId) {
                    <tr [class.exceeded]="row.toleranceStatus === 'EXCEEDED'">
                      <td data-label="Obra">{{ row.worksiteName ?? '-' }}</td>
                      <td data-label="Almacén">{{ row.warehouseName ?? '-' }}</td>
                      <td data-label="Material"><span class="code">{{ row.sku }}</span> {{ row.materialName }}</td>
                      <td data-label="Despachos" class="num">{{ row.dispatchCount }}</td>
                      <td data-label="Despachado" class="num">{{ row.dispatched | number: '1.0-3' }} {{ row.unit }}</td>
                      <td data-label="Recibido" class="num">{{ row.received | number: '1.0-3' }}</td>
                      <td data-label="Por recibir" class="num">{{ row.pendingReception | number: '1.0-3' }}</td>
                      <td data-label="Merma" class="num">{{ row.shrinkage === null ? '-' : (row.shrinkage | number: '1.0-3') }}</td>
                      <td data-label="Merma %" class="num">
                        <strong>{{ row.shrinkagePercent === null ? '-' : (row.shrinkagePercent | number: '1.2-2') + ' %' }}</strong>
                      </td>
                      <td data-label="Tolerancia" class="num">{{ row.tolerancePercent === null ? '-' : (row.tolerancePercent | number: '1.0-2') + ' %' }}</td>
                      <td data-label="Estado"><span class="badge" [class]="'badge ' + badge(row.toleranceStatus)">{{ toleranceLabel(row.toleranceStatus) }}</span></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <h2>Totales por unidad</h2>
            <div class="table-wrap">
              <table class="table" data-testid="report-totals">
                <thead>
                  <tr><th>Unidad</th><th class="num">Despachado</th><th class="num">Recibido</th><th class="num">Por recibir</th><th class="num">Merma</th><th class="num">Merma %</th></tr>
                </thead>
                <tbody>
                  @for (t of r.totalsByUnit; track t.unit) {
                    <tr>
                      <td data-label="Unidad"><strong>{{ t.unit }}</strong></td>
                      <td data-label="Despachado" class="num">{{ t.dispatched | number: '1.0-3' }}</td>
                      <td data-label="Recibido" class="num">{{ t.received | number: '1.0-3' }}</td>
                      <td data-label="Por recibir" class="num">{{ t.pendingReception | number: '1.0-3' }}</td>
                      <td data-label="Merma" class="num">{{ t.shrinkage === null ? '-' : (t.shrinkage | number: '1.0-3') }}</td>
                      <td data-label="Merma %" class="num">{{ t.shrinkagePercent === null ? '-' : (t.shrinkagePercent | number: '1.2-2') + ' %' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        } @else {
          <div class="empty">
            <strong>Sin despachos en el periodo</strong>
            <p>No hay despachos que coincidan con los filtros. Amplía el periodo o quita la obra o el almacén.</p>
          </div>
        }

        <div class="card">
          <h2>Casos pendientes ({{ r.pendingCases.length }})</h2>
          @if (r.pendingCases.length) {
            <ul class="list-plain cases" data-testid="pending-cases">
              @for (c of r.pendingCases; track $index) {
                <li>
                  <span class="badge" [class]="c.type === 'OPEN_DISCREPANCY' ? 'badge badge-bad' : 'badge badge-info'">{{ caseLabel(c) }}</span>
                  <span>
                    <strong>{{ c.manifestCode ?? '' }}</strong> {{ c.material ?? '' }}
                    <span class="muted">· {{ c.worksiteName }} desde {{ c.warehouseName }}</span>
                    @if (c.detail) {
                      <span class="muted">· {{ c.detail }}</span>
                    }
                  </span>
                  <span class="muted since">{{ c.since ? (c.since | date: 'dd/MM/yyyy HH:mm') : '' }}</span>
                  @if (c.discrepancyId) {
                    <a [routerLink]="['/discrepancies', c.discrepancyId]">Ver</a>
                  }
                </li>
              }
            </ul>
          } @else {
            <p class="muted">No hay despachos sin conformidad ni discrepancias abiertas.</p>
          }
        </div>
        <p class="muted generated">Generado el {{ r.generatedAt | date: 'dd/MM/yyyy HH:mm' }}{{ r.generatedBy ? ' por ' + r.generatedBy : '' }}.</p>
        }
      }
    </section>
  `,
  styles: `
    .summary {
      margin-bottom: var(--bs-gap);
      dd {
        font-family: var(--bs-font-display);
        font-size: 1.75rem;
        font-weight: 800;
      }
      dd.bad {
        color: var(--bs-merma);
      }
    }
    tr.exceeded {
      background: var(--bs-merma-bg);
    }
    .cases li {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 8px 12px;
      padding: 10px 0;
      border-bottom: 1px solid var(--bs-junta-suave);
    }
    .cases li:last-child {
      border-bottom: none;
    }
    .since {
      margin-left: auto;
      font-variant-numeric: tabular-nums;
    }
    .generated {
      font-size: 0.875rem;
    }
  `,
})
export class ReconciliationReportPageComponent implements OnInit {
  private readonly reports = inject(ReportsApiService);
  private readonly organization = inject(OrganizationApiService);
  private readonly auth = inject(AuthService);
  private readonly saver = inject(FileSaver);

  protected readonly worksites = signal<Worksite[]>([]);
  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly report = signal<ReconciliationReport | null>(null);
  protected readonly loading = signal(true);
  protected readonly downloading = signal<ExportFormat | null>(null);
  protected readonly error = signal<string | null>(null);
  /** Filtros con los que se armó el reporte visible: la descarga usa los mismos. */
  private readonly applied = signal<ReportQuery>({});

  protected readonly lead = computed(() => {
    switch (this.auth.role()) {
      case 'WAREHOUSE_MANAGER':
        return 'Lo despachado desde tus almacenes contra lo recibido en obra, con la merma de cada material frente a su tolerancia.';
      case 'SITE_MANAGER':
        return 'Lo despachado a tus obras contra lo recibido, con la merma de cada material frente a su tolerancia.';
      default:
        return 'Lo despachado contra lo recibido en toda la organización, con la merma de cada material frente a su tolerancia.';
    }
  });

  protected readonly filters = inject(FormBuilder).nonNullable.group({
    worksiteId: [''],
    warehouseId: [''],
    from: [''],
    to: [''],
  });

  ngOnInit(): void {
    this.organization.listWorksites().subscribe({
      next: (list) => this.worksites.set(list),
      error: () => undefined,
    });
    this.organization.listWarehouses().subscribe({
      next: (list) => this.warehouses.set(list),
      error: () => undefined,
    });
    this.search();
  }

  protected toleranceLabel(status: ToleranceStatus): string {
    return TOLERANCE_STATUS_LABELS[status] ?? status;
  }

  protected badge(status: ToleranceStatus): string {
    return toleranceBadge(status);
  }

  protected caseLabel(c: PendingCase): string {
    return PENDING_CASE_LABELS[c.type] ?? c.type;
  }

  protected search(): void {
    const f = this.filters.getRawValue();
    if (f.from && f.to && f.from > f.to) {
      this.error.set('La fecha de inicio no puede ser posterior a la de fin.');
      return;
    }
    const query: ReportQuery = {
      worksiteId: f.worksiteId || undefined,
      warehouseId: f.warehouseId || undefined,
      from: f.from || undefined,
      to: f.to || undefined,
    };
    this.loading.set(true);
    this.error.set(null);
    this.reports.reconciliation(query).subscribe({
      next: (report) => {
        this.report.set(report);
        this.applied.set(query);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.report.set(null);
        this.error.set(toApiError(err).message);
      },
    });
  }

  protected download(format: ExportFormat): void {
    this.downloading.set(format);
    this.error.set(null);
    this.reports.export(this.applied(), format).subscribe({
      next: (file) => {
        this.downloading.set(null);
        this.saver.save(file.blob, file.fileName);
      },
      error: (err: unknown) => {
        this.downloading.set(null);
        this.error.set(`No se pudo descargar el ${format.toUpperCase()}. ${toApiError(err).message}`);
      },
    });
  }
}
