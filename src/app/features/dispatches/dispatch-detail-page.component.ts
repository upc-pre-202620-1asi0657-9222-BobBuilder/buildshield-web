import {DatePipe, DecimalPipe} from '@angular/common';
import {Component, OnInit, computed, inject, input, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {Observable} from 'rxjs';

import {LogisticsApi} from '../../core/api/logistics-api';
import {toApiError} from '../../core/http/api-error';
import {Dispatch, dispatchStatusLabel} from '../../core/models/logistics';
import {generateUuid} from '../../core/util/uuid';
import {statusBadgeClass} from '../../shared/status';

/** Transportista, pesaje de salida y salida del despacho; enlace al manifiesto imprimible. */
@Component({
  selector: 'app-dispatch-detail-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe, DecimalPipe],
  templateUrl: './dispatch-detail-page.component.html',
})
export class DispatchDetailPageComponent implements OnInit {
  /** Parámetro :id de la ruta. */
  readonly id = input.required<string>();

  private readonly logistics = inject(LogisticsApi);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly dispatch = signal<Dispatch | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly label = dispatchStatusLabel;
  protected readonly badge = statusBadgeClass;

  protected readonly preparing = computed(() => this.dispatch()?.status === 'PREPARING');
  protected readonly canDepart = computed(() => {
    const d = this.dispatch();
    return !!d && d.status === 'PREPARING' && !!d.carrier && !!d.departureWeighing;
  });

  /** Se reusa si el usuario vuelve a pulsar «Despachar» tras un error. */
  private departKey = generateUuid();

  protected readonly carrierForm = this.fb.group({
    carrierName: ['', [Validators.required, Validators.maxLength(150)]],
    carrierDocument: ['', [Validators.required, Validators.pattern(/^(\d{8}|\d{11})$/)]],
    plate: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9]{3}-?[A-Za-z0-9]{3}$/)]],
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
        this.busy.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }

  private apply(dispatch: Dispatch): void {
    this.dispatch.set(dispatch);
    if (dispatch.carrier) {
      this.carrierForm.reset(dispatch.carrier);
    }
    if (dispatch.departureWeighing) {
      this.weighingForm.reset({
        grossKg: dispatch.departureWeighing.grossKg,
        tareKg: dispatch.departureWeighing.tareKg,
        ticketPhotoUrl: dispatch.departureWeighing.ticketPhotoUrl ?? '',
      });
    }
    if (dispatch.status !== 'PREPARING') {
      this.carrierForm.disable();
      this.weighingForm.disable();
    }
  }
}
