import {DatePipe} from '@angular/common';
import {Component, OnInit, computed, inject, signal} from '@angular/core';
import {RouterLink} from '@angular/router';

import {InventoryApiService} from '../../core/api/inventory-api.service';
import {AuthService} from '../../core/auth/auth.service';
import {toApiError} from '../../core/http/api-error';
import {MaterialReturn, RETURN_STATUS_LABELS, ReturnStatus} from '../../core/models/inventory';
import {IconComponent} from '../../shared/icon.component';
import {returnActions, returnBadge, returnStatusLabel} from './return-status';

/** T92 (US43): devoluciones de saldos de obra al almacén de origen. */
@Component({
  selector: 'app-return-list-page',
  standalone: true,
  imports: [DatePipe, RouterLink, IconComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <h1>Devoluciones</h1>
        @if (canRegister()) {
          <div class="actions">
            <a class="btn btn-primary" routerLink="/returns/new">
              <app-icon name="plus" />
              Devolver saldo de obra
            </a>
          </div>
        }
      </div>
      <p class="lead">{{ lead() }}</p>

      <div class="field status-filter">
        <label for="r-status">Estado</label>
        <select id="r-status" [value]="status()" (change)="filter($any($event.target).value)">
          <option value="">Todos</option>
          @for (s of statuses; track s) {
            <option [value]="s">{{ label(s) }}</option>
          }
        </select>
      </div>

      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }
      @if (loading()) {
        <p class="loading">Cargando devoluciones…</p>
      } @else if (returns().length) {
        <div class="card">
          <div class="table-wrap">
            <table class="table" data-testid="returns">
              <thead>
                <tr><th>Registro</th><th>Obra</th><th>Almacén de origen</th><th>Estado</th><th class="num">Materiales</th><th></th></tr>
              </thead>
              <tbody>
                @for (r of returns(); track r.id) {
                  <tr>
                    <td data-label="Registro">{{ r.registeredAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                    <td data-label="Obra">{{ r.worksiteName ?? '-' }}</td>
                    <td data-label="Almacén de origen">{{ r.warehouseName ?? '-' }}</td>
                    <td data-label="Estado">
                      <span class="badge" [class]="'badge ' + badge(r.status)">{{ label(r.status) }}</span>
                      @if (r.hasRejections) {
                        <span class="badge badge-bad">Con rechazos</span>
                      }
                    </td>
                    <td data-label="Materiales" class="num">{{ r.lines.length }}</td>
                    <td class="row-actions">
                      <a class="btn" [class.btn-ghost]="!pending(r)" [routerLink]="['/returns', r.id]">
                        {{ pending(r) ? 'Atender' : 'Ver' }}
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @else if (!error()) {
        <div class="empty">
          <strong>No hay devoluciones</strong>
          @if (canRegister()) {
            <p>Cuando una obra termina con material sobrante, devuélvelo al almacén que lo despachó.</p>
            <a class="btn" routerLink="/returns/new">Devolver saldo de obra</a>
          } @else {
            <p>Aquí aparecen las devoluciones que las obras envían a tus almacenes.</p>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .status-filter {
      max-width: 280px;
      margin-bottom: var(--bs-gap);
    }
    td .badge + .badge {
      margin-left: 6px;
    }
  `,
})
export class ReturnListPageComponent implements OnInit {
  private readonly api = inject(InventoryApiService);
  private readonly auth = inject(AuthService);

  protected readonly statuses = Object.keys(RETURN_STATUS_LABELS) as ReturnStatus[];
  protected readonly returns = signal<MaterialReturn[]>([]);
  protected readonly status = signal<ReturnStatus | ''>('');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly canRegister = computed(() => {
    const role = this.auth.role();
    return role === 'SITE_MANAGER' || role === 'ADMINISTRATOR';
  });
  protected readonly lead = computed(() =>
    this.auth.role() === 'WAREHOUSE_MANAGER'
      ? 'Devoluciones dirigidas a tus almacenes: apruébalas o recházalas y verifica lo que llega.'
      : 'Material sobrante que vuelve de la obra al almacén que lo despachó. Lo que el almacén no acepta queda registrado con su motivo.',
  );

  ngOnInit(): void {
    this.load();
  }

  protected label(status: ReturnStatus): string {
    return returnStatusLabel(status);
  }

  protected badge(status: ReturnStatus): string {
    return returnBadge(status);
  }

  /** Tiene una acción pendiente para el rol actual. */
  protected pending(ret: MaterialReturn): boolean {
    return returnActions(ret, this.auth.role()).some((a) => a !== 'cancel');
  }

  protected filter(status: ReturnStatus | ''): void {
    this.status.set(status);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listReturns({status: this.status() || undefined}).subscribe({
      next: (list) => {
        this.returns.set([...list].sort((a, b) => b.registeredAt.localeCompare(a.registeredAt)));
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }
}
