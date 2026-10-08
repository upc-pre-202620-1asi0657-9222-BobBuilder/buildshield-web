import {DatePipe, DecimalPipe} from '@angular/common';
import {Component, OnInit, computed, inject, input, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {Observable} from 'rxjs';

import {LogisticsApi} from '../../core/api/logistics-api';
import {AuthService} from '../../core/auth/auth.service';
import {shouldReuseIdempotencyKey, toApiError} from '../../core/http/api-error';
import {Discrepancy, discrepancyStatusLabel, discrepancyTypeLabel} from '../../core/models/discrepancy';
import {generateUuid} from '../../core/util/uuid';
import {IconComponent} from '../../shared/icon.component';
import {statusBadgeClass} from '../../shared/status';
import {discrepancyActionsFor, evidenceProblem, nextStepHint} from './discrepancy-actions';

const NOTE_MIN = 3;

/**
 * US36: detalle de la discrepancia con evidencias y su ciclo: el almacén
 * responde, la obra acepta o escala y el administrador resuelve.
 */
@Component({
  selector: 'app-discrepancy-detail-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe, IconComponent],
  templateUrl: './discrepancy-detail-page.component.html',
  styleUrl: './discrepancy-detail-page.component.scss',
})
export class DiscrepancyDetailPageComponent implements OnInit {
  /** Parámetro :id de la ruta. */
  readonly id = input.required<string>();

  private readonly logistics = inject(LogisticsApi);
  private readonly auth = inject(AuthService);

  protected readonly discrepancy = signal<Discrepancy | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly uploading = signal(false);
  protected readonly escalating = signal(false);
  protected readonly statusLabel = discrepancyStatusLabel;
  protected readonly typeLabel = discrepancyTypeLabel;
  protected readonly badge = statusBadgeClass;

  protected readonly actions = computed(() =>
    discrepancyActionsFor(this.auth.role(), this.discrepancy()?.status ?? ''),
  );
  protected readonly hasAction = computed(() => {
    const a = this.actions();
    return a.respond || a.accept || a.escalate || a.resolve;
  });
  protected readonly hint = computed(() => nextStepHint(this.discrepancy()?.status ?? ''));

  protected responseText = '';
  protected escalateReason = '';
  protected decision = '';

  /** Una clave por acción, reusada si el usuario reintenta tras una falla de red. */
  private key = generateUuid();

  ngOnInit(): void {
    this.logistics.getDiscrepancy(this.id()).subscribe({
      next: (d) => this.discrepancy.set(d),
      error: (err: unknown) => this.error.set(toApiError(err).message),
    });
  }

  protected respond(): void {
    const text = this.responseText.trim();
    if (this.tooShort(text, 'Escribe la respuesta del almacén.')) {
      return;
    }
    this.run(this.logistics.respondDiscrepancy(this.id(), text, this.key), 'Respuesta enviada a la obra.');
  }

  protected accept(): void {
    this.run(this.logistics.acceptDiscrepancy(this.id(), this.key), 'Aceptaste la respuesta. La discrepancia quedó cerrada.');
  }

  protected escalate(): void {
    const reason = this.escalateReason.trim();
    if (this.tooShort(reason, 'Explica por qué no aceptas la respuesta.')) {
      return;
    }
    this.run(
      this.logistics.escalateDiscrepancy(this.id(), reason, this.key),
      'Discrepancia escalada al administrador.',
    );
  }

  protected resolve(): void {
    const decision = this.decision.trim();
    if (this.tooShort(decision, 'Escribe la decisión final.')) {
      return;
    }
    this.run(this.logistics.resolveDiscrepancy(this.id(), decision, this.key), 'Decisión registrada. La discrepancia quedó cerrada.');
  }

  protected onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    const problem = evidenceProblem(file);
    if (problem) {
      this.error.set(problem);
      return;
    }
    this.uploading.set(true);
    this.error.set(null);
    this.success.set(null);
    this.logistics.uploadEvidence(this.id(), file).subscribe({
      next: (evidence) => {
        this.uploading.set(false);
        this.success.set('Foto subida.');
        this.discrepancy.update((d) => (d ? {...d, evidences: [...d.evidences, evidence]} : d));
      },
      error: (err: unknown) => {
        this.uploading.set(false);
        this.error.set(toApiError(err).message);
      },
    });
  }

  private tooShort(text: string, message: string): boolean {
    if (text.length < NOTE_MIN) {
      this.error.set(message);
      return true;
    }
    return false;
  }

  private run(request: Observable<Discrepancy>, message: string): void {
    this.busy.set(true);
    this.error.set(null);
    this.success.set(null);
    request.subscribe({
      next: (d) => {
        this.busy.set(false);
        this.key = generateUuid();
        this.escalating.set(false);
        this.discrepancy.set(d);
        this.success.set(message);
      },
      error: (err: unknown) => {
        const apiError = toApiError(err);
        this.busy.set(false);
        this.error.set(apiError.message);
        if (!shouldReuseIdempotencyKey(apiError)) {
          this.key = generateUuid();
        }
      },
    });
  }
}
