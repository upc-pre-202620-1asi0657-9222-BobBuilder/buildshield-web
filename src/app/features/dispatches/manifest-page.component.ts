import {DatePipe, DecimalPipe, Location} from '@angular/common';
import {Component, OnInit, computed, inject, input, signal} from '@angular/core';

import {LogisticsApi} from '../../core/api/logistics-api';
import {toApiError} from '../../core/http/api-error';
import {
  DISPATCH_TYPE_LABELS,
  DispatchManifest,
  dispatchStatusLabel,
} from '../../core/models/logistics';
import {IconComponent} from '../../shared/icon.component';

/** T32: manifiesto imprimible del despacho con su QR (hoja A4, estilos de impresión). */
@Component({
  selector: 'app-manifest-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, IconComponent],
  templateUrl: './manifest-page.component.html',
  styleUrl: './manifest-page.component.scss',
})
export class ManifestPageComponent implements OnInit {
  /** Parámetro :id de la ruta. */
  readonly id = input.required<string>();

  private readonly logistics = inject(LogisticsApi);
  private readonly location = inject(Location);

  protected readonly simulated = this.logistics.simulated;
  protected readonly manifest = signal<DispatchManifest | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly label = dispatchStatusLabel;
  protected typeLabel(type: string): string {
    return DISPATCH_TYPE_LABELS[type] ?? type;
  }
  protected readonly qrSrc = computed(() => {
    const m = this.manifest();
    if (!m?.qrCodePngBase64) {
      return null;
    }
    return m.qrCodePngBase64.startsWith('data:')
      ? m.qrCodePngBase64
      : `data:image/png;base64,${m.qrCodePngBase64}`;
  });
  protected readonly printedAt = new Date();

  ngOnInit(): void {
    this.logistics.getManifest(this.id()).subscribe({
      next: (m) => this.manifest.set(m),
      error: (err: unknown) => this.error.set(toApiError(err).message),
    });
  }

  protected back(): void {
    this.location.back();
  }

  protected print(): void {
    window.print();
  }

  protected netKg(m: DispatchManifest): number | null {
    const w = m.departureWeighing;
    if (!w) {
      return null;
    }
    return w.netKg;
  }
}
