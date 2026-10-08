import {DatePipe, DecimalPipe} from '@angular/common';
import {Component, OnInit, computed, inject, input, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {Observable} from 'rxjs';

import {LogisticsApi} from '../../core/api/logistics-api';
import {OrganizationApiService} from '../../core/api/organization-api.service';
import {Material} from '../../core/models/organization';
import {shouldReuseIdempotencyKey, toApiError} from '../../core/http/api-error';
import {DISPATCH_TYPE_LABELS, Dispatch, dispatchStatusLabel} from '../../core/models/logistics';
import {generateUuid} from '../../core/util/uuid';
import {DispatchTrackComponent} from '../../shared/dispatch-track.component';
import {DispatchCancelComponent} from './dispatch-cancel.component';
import {DispatchIncidentsComponent} from './dispatch-incidents.component';
import {IconComponent} from '../../shared/icon.component';
import {statusBadgeClass} from '../../shared/status';

/**
 * Transportista, pesaje de salida y salida del despacho; enlace al manifiesto
 * imprimible. Sprint 3: anulación (US25), incidencias en ruta (US32) y enlace
 * al historial de custodia (US39).
 */
@Component({
  selector: 'app-dispatch-detail-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    DecimalPipe,
    IconComponent,
    DispatchTrackComponent,
    DispatchCancelComponent,
    DispatchIncidentsComponent,
  ],
  templateUrl: './dispatch-detail-page.component.html',
})
export class DispatchDetailPageComponent implements OnInit {
  /** Parámetro :id de la ruta. */
  readonly id = input.required<string>();

  private readonly logistics = inject(LogisticsApi);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly orgApi = inject(OrganizationApiService);

  protected readonly materials = signal(new Map<string, Material>());

  protected readonly dispatch = signal<Dispatch | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly label = dispatchStatusLabel;
  protected readonly badge = statusBadgeClass;
  protected readonly typeLabels = DISPATCH_TYPE_LABELS;

  protected readonly preparing = computed(() => this.dispatch()?.status === 'PREPARED');
  protected readonly canDepart = computed(() => {
    const d = this.dispatch();
    return !!d && d.status === 'PREPARED' && !!d.carrier && !!d.departureWeighing;
  });

  /** Se reusa si el usuario vuelve a pulsar «Despachar» tras un error. */
  private departKey = generateUuid();

  protected readonly carrierForm = this.fb.group({
    carrierName: ['', [Validators.required, Validators.maxLength(150)]],
    carrierDocument: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9]{8,20}$/)]],
    plate: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9-]{5,10}$/)]],
  });

  protected readonly weighingForm = this.fb.group({
    grossKg: [0, [Validators.required, Validators.min(0.001)]],
    tareKg: [0, [Validators.required, Validators.min(0)]],
    ticketPhotoUrl: [''],
  });

  ngOnInit(): void {
    this.logistics.getDispatch(this.id()).subscribe({
      next: (d) => this.apply(d),
      error: (err: unknown) => this.error.set(toApiError(err).message),
    });
    this.orgApi.listMaterials().subscribe({
      next: (list) => this.materials.set(new Map(list.map((m) => [m.id, m]))),
      error: () => this.materials.set(new Map()),
    });
  }

  protected material(id: string): Material | undefined {
    return this.materials().get(id);
  }

  protected saveCarrier(): void {
    if (this.carrierForm.invalid) {
      this.carrierForm.markAllAsTouched();
      return;
    }
    const value = this.carrierForm.getRawValue();
    this.run(
      this.logistics.setCarrier(this.id(), {...value, plate: value.plate.toUpperCase()}),
      'Transportista guardado.',
    );
  }

  protected saveWeighing(): void {
    const value = this.weighingForm.getRawValue();
    if (this.weighingForm.invalid || Number(value.grossKg) <= Number(value.tareKg)) {
      this.weighingForm.markAllAsTouched();
      this.error.set('El peso bruto debe ser mayor que la tara.');
      return;
    }
    this.run(
      this.logistics.registerDepartureWeighing(this.id(), {
        grossKg: Number(value.grossKg),
        tareKg: Number(value.tareKg),
        ticketPhotoUrl: value.ticketPhotoUrl.trim() || null,
      }),
      'Pesaje de salida registrado.',
    );
  }

  protected onCancelled(dispatch: Dispatch): void {
    this.error.set(null);
    this.success.set('Despacho anulado. Lo despachado volvió a quedar pendiente en el pedido.');
    this.apply(dispatch);
  }

  protected onIncidentReported(): void {
    this.success.set('Incidencia registrada.');
    this.dispatch.update((d) => (d ? {...d, incidentCount: (d.incidentCount ?? 0) + 1} : d));
  }

  protected depart(): void {
    this.run(this.logistics.depart(this.id(), this.departKey), 'Despacho en tránsito.');
  }

  protected netKg(): number {
    const v = this.weighingForm.getRawValue();
    return Math.max(0, Number(v.grossKg) - Number(v.tareKg));
  }

  private run(request: Observable<Dispatch>, message: string): void {
    this.busy.set(true);
    this.error.set(null);
    this.success.set(null);
    request.subscribe({
      next: (d) => {
        this.busy.set(false);
        this.success.set(message);
        this.apply(d);
      },
      error: (err: unknown) => {
        const apiError = toApiError(err);
        this.busy.set(false);
        this.error.set(apiError.message);
        if (!shouldReuseIdempotencyKey(apiError)) {
          this.departKey = generateUuid();
        }
      },
    });
  }

  private apply(dispatch: Dispatch): void {
    this.dispatch.set(dispatch);
    if (dispatch.carrier) {
      this.carrierForm.reset({
        carrierName: dispatch.carrier.name,
        carrierDocument: dispatch.carrier.document,
        plate: dispatch.carrier.plate,
      });
    }
    if (dispatch.departureWeighing) {
      this.weighingForm.reset({
        grossKg: dispatch.departureWeighing.grossKg,
        tareKg: dispatch.departureWeighing.tareKg,
        ticketPhotoUrl: dispatch.departureWeighing.ticketPhotoUrl ?? '',
      });
    }
    if (dispatch.status !== 'PREPARED') {
      this.carrierForm.disable();
      this.weighingForm.disable();
    }
  }
}
