import {DatePipe, DecimalPipe} from '@angular/common';
import {Component, OnInit, computed, inject, input, signal} from '@angular/core';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {Observable} from 'rxjs';

import {InventoryApiService} from '../../core/api/inventory-api.service';
import {AuthService} from '../../core/auth/auth.service';
import {toApiError} from '../../core/http/api-error';
import {MaterialReturn} from '../../core/models/inventory';
import {IconComponent} from '../../shared/icon.component';
import {ReturnAction, returnActions, returnBadge, returnStatusLabel} from './return-status';

interface Verification {
  accepted: string;
  reason: string;
}

/**
 * T92 (US43): una devolución de saldo. Cada rol ve solo los pasos que le tocan:
 * la obra solicita, inicia el retorno o anula; el almacén de origen aprueba,
 * rechaza con motivo y recibe indicando lo aceptado y lo rechazado.
 */
@Component({
  selector: 'app-return-detail-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, IconComponent],
  template: `
    <section class="page">
      @if (ret(); as r) {
        <div class="page-header">
          <div>
            <a class="eyebrow" routerLink="/returns">Devoluciones</a>
            <h1>Devolución de {{ r.worksiteName }}</h1>
          </div>
          <span class="badge" [class]="'badge ' + badge()" data-testid="return-status">{{ statusLabel() }}</span>
        </div>
        @if (message()) {
          <p class="alert alert-success" role="status">{{ message() }}</p>
        }
        @if (error()) {
          <p class="alert alert-error" role="alert">{{ error() }}</p>
        }
        @if (r.status === 'REJECTED') {
          <p class="alert alert-error">El almacén rechazó la solicitud: {{ r.rejectionReason }}. El saldo sigue en la obra.</p>
        }

        <dl class="kv">
          <div><dt>Almacén de origen</dt><dd>{{ r.warehouseName }}</dd></div>
          <div><dt>Registrada</dt><dd>{{ r.registeredAt | date: 'dd/MM/yyyy HH:mm' }}</dd></div>
          <div><dt>Solicitada</dt><dd>{{ r.requestedAt ? (r.requestedAt | date: 'dd/MM/yyyy HH:mm') : '-' }}</dd></div>
          <div><dt>Decisión del almacén</dt><dd>{{ r.decidedAt ? (r.decidedAt | date: 'dd/MM/yyyy HH:mm') : '-' }}</dd></div>
          <div><dt>Salida de la obra</dt><dd>{{ r.dispatchedAt ? (r.dispatchedAt | date: 'dd/MM/yyyy HH:mm') : '-' }}</dd></div>
          <div><dt>Recepción en almacén</dt><dd>{{ r.receivedAt ? (r.receivedAt | date: 'dd/MM/yyyy HH:mm') : '-' }}</dd></div>
        </dl>
        @if (r.note) {
          <p class="muted">Observación: {{ r.note }}</p>
        }

        <div class="card">
          <h2>Materiales</h2>
          <div class="table-wrap">
            <table class="table" data-testid="return-lines">
              <thead>
                <tr>
                  <th>Material</th>
                  <th class="num">Devuelto</th>
                  <th>Estado declarado</th>
                  @if (receiving()) {
                    <th class="num">Aceptado</th>
                    <th>Motivo de lo no aceptado</th>
                  } @else if (r.status === 'RECEIVED') {
                    <th class="num">Aceptado</th>
                    <th class="num">Rechazado</th>
                    <th>Motivo</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (l of r.lines; track l.materialId) {
                  <tr [attr.data-material]="l.sku">
                    <td data-label="Material"><span class="code">{{ l.sku }}</span> {{ l.materialName }}</td>
                    <td data-label="Devuelto" class="num">{{ l.quantity | number: '1.0-3' }} {{ l.unit }}</td>
                    <td data-label="Estado declarado">{{ l.detail ?? '' }}</td>
                    @if (receiving()) {
                      <td data-label="Aceptado" class="num">
                        <input
                          class="qty"
                          type="number"
                          inputmode="decimal"
                          min="0"
                          step="0.001"
                          [max]="l.quantity"
                          [attr.aria-label]="'Aceptado de ' + l.materialName"
                          [value]="verification()[l.materialId]?.accepted ?? ''"
                          (input)="setVerification(l.materialId, 'accepted', $any($event.target).value)"
                        />
                      </td>
                      <td data-label="Motivo">
                        <input
                          class="reason"
                          type="text"
                          maxlength="200"
                          [attr.aria-label]="'Motivo de lo no aceptado de ' + l.materialName"
                          [value]="verification()[l.materialId]?.reason ?? ''"
                          (input)="setVerification(l.materialId, 'reason', $any($event.target).value)"
                        />
                      </td>
                    } @else if (r.status === 'RECEIVED') {
                      <td data-label="Aceptado" class="num"><strong>{{ l.acceptedQty | number: '1.0-3' }}</strong></td>
                      <td data-label="Rechazado" class="num">
                        @if (l.rejectedQty) {
                          <span class="badge badge-bad">{{ l.rejectedQty | number: '1.0-3' }}</span>
                        } @else {
                          0
                        }
                      </td>
                      <td data-label="Motivo">{{ l.rejectionReason ?? '' }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (r.status === 'RECEIVED' && r.hasRejections) {
            <p class="alert alert-warning">
              Lo rechazado no vuelve al stock del almacén: queda registrado con su motivo.
            </p>
          }
          @if (receiving()) {
            <p class="muted">Escribe lo que aceptas de cada material. Si no aceptas todo, explica por qué.</p>
            <div class="form-actions">
              <button class="btn btn-primary" type="button" [disabled]="busy()" (click)="receive()" data-testid="receive-return">
                <app-icon name="check" />
                Confirmar recepción
              </button>
              <button class="btn btn-ghost" type="button" (click)="receiving.set(false)">Volver</button>
            </div>
          }
        </div>

        @if (rejecting()) {
          <div class="card">
            <h2>Rechazar la solicitud</h2>
            <div class="field">
              <label for="reject-reason">Motivo</label>
              <textarea id="reject-reason" rows="3" maxlength="500" [value]="reason()" (input)="reason.set($any($event.target).value)"></textarea>
            </div>
            <div class="form-actions">
              <button class="btn btn-danger" type="button" [disabled]="busy() || !reason().trim()" (click)="reject()" data-testid="confirm-reject">
                Rechazar solicitud
              </button>
              <button class="btn btn-ghost" type="button" (click)="rejecting.set(false)">Volver</button>
            </div>
          </div>
        }

        @if (!receiving() && !rejecting() && actions().length) {
          <div class="form-actions" data-testid="return-actions">
            @for (a of actions(); track a) {
              @switch (a) {
                @case ('request') {
                  <button class="btn btn-primary" type="button" [disabled]="busy()" (click)="act('request')">Solicitar devolución</button>
                }
                @case ('approve') {
                  <button class="btn btn-primary" type="button" [disabled]="busy()" (click)="act('approve')">Aprobar</button>
                }
                @case ('reject') {
                  <button class="btn btn-danger" type="button" [disabled]="busy()" (click)="rejecting.set(true)">Rechazar</button>
                }
                @case ('dispatch') {
                  <button class="btn btn-primary" type="button" [disabled]="busy()" (click)="act('dispatch')">
                    <app-icon name="truck" />
                    Iniciar retorno
                  </button>
                }
                @case ('receive') {
                  <button class="btn btn-primary" type="button" [disabled]="busy()" (click)="startReceiving()">
                    <app-icon name="reception" />
                    Recibir en almacén
                  </button>
                }
                @case ('cancel') {
                  <button class="btn btn-danger" type="button" [disabled]="busy()" (click)="act('cancel')">Anular</button>
                }
              }
            }
          </div>
        }
      } @else if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      } @else {
        <p class="loading">Cargando devolución…</p>
      }
    </section>
  `,
  styles: `
    .qty,
    .reason {
      min-height: 44px;
      padding: 8px 10px;
      border: 1.5px solid var(--bs-junta);
      border-radius: var(--bs-radius-control);
      font: inherit;
    }
    .qty {
      width: 110px;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .reason {
      width: 100%;
      min-width: 200px;
    }
  `,
})
export class ReturnDetailPageComponent implements OnInit {
  readonly id = input.required<string>();

  private readonly api = inject(InventoryApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  protected readonly ret = signal<MaterialReturn | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly receiving = signal(false);
  protected readonly rejecting = signal(false);
  protected readonly reason = signal('');
  protected readonly verification = signal<Record<string, Verification | undefined>>({});

  protected readonly statusLabel = computed(() => {
    const r = this.ret();
    return r ? returnStatusLabel(r.status) : '';
  });
  protected readonly badge = computed(() => {
    const r = this.ret();
    return r ? returnBadge(r.status) : '';
  });
  protected readonly actions = computed(() => {
    const r = this.ret();
    return r ? returnActions(r, this.auth.role()) : [];
  });

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('registrada') === '1') {
      this.message.set('Devolución registrada. Solicítala para que el almacén de origen la apruebe.');
    }
    this.api.getReturn(this.id()).subscribe({
      next: (ret) => this.ret.set(ret),
      error: (err: unknown) => this.error.set(toApiError(err).message),
    });
  }

  protected act(action: Exclude<ReturnAction, 'reject' | 'receive'>): void {
    const id = this.id();
    const calls: Record<typeof action, () => Observable<MaterialReturn>> = {
      request: () => this.api.requestReturn(id),
      approve: () => this.api.approveReturn(id),
      dispatch: () => this.api.dispatchReturn(id),
      cancel: () => this.api.cancelReturn(id),
    };
    const messages: Record<typeof action, string> = {
      request: 'Devolución solicitada. El almacén de origen debe aprobarla.',
      approve: 'Devolución aprobada. La obra ya puede enviar el material.',
      dispatch: 'Retorno iniciado: el material salió de la obra hacia el almacén.',
      cancel: 'Devolución anulada. El saldo sigue en la obra.',
    };
    this.run(calls[action](), messages[action]);
  }

  protected startReceiving(): void {
    const values: Record<string, Verification> = {};
    this.ret()?.lines.forEach((l) => (values[l.materialId] = {accepted: String(l.quantity), reason: ''}));
    this.verification.set(values);
    this.receiving.set(true);
  }

  protected setVerification(materialId: string, field: keyof Verification, value: string): void {
    this.verification.update((current) => ({
      ...current,
      [materialId]: {accepted: '', reason: '', ...current[materialId], [field]: value},
    }));
  }

  protected receive(): void {
    const r = this.ret();
    if (!r) {
      return;
    }
    const values = this.verification();
    const lines = r.lines.map((l) => ({
      materialId: l.materialId,
      acceptedQty: Number(values[l.materialId]?.accepted ?? 0),
      rejectionReason: values[l.materialId]?.reason.trim() || null,
      quantity: l.quantity,
      name: l.materialName,
    }));
    const invalid = lines.find((l) => !Number.isFinite(l.acceptedQty) || l.acceptedQty < 0 || l.acceptedQty > l.quantity);
    if (invalid) {
      this.error.set(`Lo aceptado de ${invalid.name} debe estar entre 0 y lo devuelto.`);
      return;
    }
    const missingReason = lines.find((l) => l.acceptedQty < l.quantity && !l.rejectionReason);
    if (missingReason) {
      this.error.set(`Explica por qué no aceptas todo ${missingReason.name}.`);
      return;
    }
    this.run(
      this.api.receiveReturn(
        r.id,
        lines.map(({materialId, acceptedQty, rejectionReason}) => ({materialId, acceptedQty, rejectionReason})),
      ),
      'Recepción confirmada: lo aceptado ya está en el stock del almacén.',
    );
  }

  protected reject(): void {
    this.run(this.api.rejectReturn(this.id(), this.reason().trim()), 'Solicitud rechazada. El saldo sigue en la obra.');
  }

  private run(action: Observable<MaterialReturn>, okMessage: string): void {
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    action.subscribe({
      next: (ret) => {
        this.busy.set(false);
        this.ret.set(ret);
        this.receiving.set(false);
        this.rejecting.set(false);
        this.reason.set('');
        this.message.set(okMessage);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }
}
