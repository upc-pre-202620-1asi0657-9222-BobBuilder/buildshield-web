import {Component, DestroyRef, ElementRef, OnInit, inject, input, signal, viewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';

import {LogisticsApi} from '../../core/api/logistics-api';
import {toApiError} from '../../core/http/api-error';
import {IconComponent} from '../../shared/icon.component';

/** Lo mínimo de la API BarcodeDetector (Chrome en Android) que usa la pantalla. */
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options?: {formats: string[]}) => BarcodeDetectorLike;

/** Cada cuánto se analiza un cuadro de la cámara. */
const SCAN_EVERY_MS = 300;

/**
 * Extrae el código del manifiesto de lo leído: el QR trae el código, pero si
 * algún día trae una URL se toma el último segmento.
 */
export function manifestCodeFrom(raw: string): string {
  const text = (raw ?? '').trim();
  if (!text.includes('/')) {
    return text.toUpperCase();
  }
  const path = text.split(/[?#]/)[0];
  return (path.split('/').filter(Boolean).pop() ?? '').toUpperCase();
}

/**
 * US34: abre la recepción con el código del manifiesto. La cámara es un atajo
 * opcional (solo si el navegador trae BarcodeDetector); el campo para escribir
 * el código siempre está visible. Al encontrarlo, lleva a /reception/{dispatchId}.
 */
@Component({
  selector: 'app-scan-page',
  standalone: true,
  imports: [FormsModule, RouterLink, IconComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <h1>Abrir por código</h1>
        <div class="actions">
          <a class="btn btn-ghost" routerLink="/reception">
            <app-icon name="back" />
            Despachos en camino
          </a>
        </div>
      </div>
      <p class="lead">
        Escribe el código del manifiesto que trae el transportista, por ejemplo MAN-20261008-1A2B3C4D.
        Lo normal es elegir el despacho en la lista de despachos en camino.
      </p>

      @if (error()) {
        <p class="alert alert-error" role="alert">{{ error() }}</p>
      }

      <form class="card" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <label for="manifestCode">Código del manifiesto</label>
          <input
            id="manifestCode"
            name="manifestCode"
            [(ngModel)]="code"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            maxlength="64"
          />
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit" [disabled]="busy()">
            <app-icon name="reception" />
            {{ busy() ? 'Buscando…' : 'Abrir recepción' }}
          </button>
          @if (cameraSupported && !scanning()) {
            <button class="btn" type="button" (click)="startCamera()" [disabled]="busy()">
              <app-icon name="camera" />
              Leer el QR con la cámara
            </button>
          }
        </div>
      </form>

      @if (scanning()) {
        <div class="card camera">
          <video #video playsinline muted aria-label="Vista de la cámara"></video>
          <p class="muted" role="status">Apunta al código QR del manifiesto.</p>
          <button class="btn btn-ghost" type="button" (click)="stopCamera()">
            <app-icon name="close" />
            Cerrar cámara
          </button>
        </div>
      }
    </section>
  `,
  styles: `
    .camera {
      display: grid;
      gap: 12px;
      justify-items: start;
    }
    video {
      width: 100%;
      max-width: 480px;
      aspect-ratio: 1;
      object-fit: cover;
      border-radius: var(--bs-radius);
      background: var(--bs-asfalto);
    }
  `,
})
export class ScanPageComponent implements OnInit {
  /** Query param ?code= opcional (por ejemplo, desde un enlace del QR). */
  readonly codeParam = input<string | undefined>(undefined, {alias: 'code'});

  private readonly logistics = inject(LogisticsApi);
  private readonly router = inject(Router);
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');

  protected readonly cameraSupported =
    typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;
  protected readonly scanning = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected code = '';

  private stream: MediaStream | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopCamera());
  }

  ngOnInit(): void {
    const preset = this.codeParam();
    if (preset) {
      this.code = manifestCodeFrom(preset);
      this.open(this.code);
    }
  }

  protected submit(): void {
    const code = manifestCodeFrom(this.code);
    if (!code) {
      this.error.set('Escribe el código del manifiesto.');
      return;
    }
    this.open(code);
  }

  protected async startCamera(): Promise<void> {
    this.error.set(null);
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'environment'}});
    } catch {
      this.error.set('No se pudo usar la cámara. Escribe el código del manifiesto.');
      return;
    }
    this.scanning.set(true);
    // Espera a que el video exista en la vista.
    setTimeout(() => this.attach());
  }

  protected stopCamera(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.scanning.set(false);
  }

  private attach(): void {
    const video = this.video()?.nativeElement;
    if (!video || !this.stream) {
      return;
    }
    video.srcObject = this.stream;
    void video.play().catch(() => undefined);
    const Detector = (window as unknown as {BarcodeDetector: BarcodeDetectorCtor}).BarcodeDetector;
    const detector = new Detector({formats: ['qr_code']});
    let detecting = false;
    this.timer = setInterval(async () => {
      if (detecting || video.readyState < 2) {
        return;
      }
      detecting = true;
      try {
        const [found] = await detector.detect(video);
        if (found?.rawValue) {
          this.code = manifestCodeFrom(found.rawValue);
          this.stopCamera();
          this.open(this.code);
        }
      } catch {
        // Cuadro ilegible: se intenta con el siguiente.
      } finally {
        detecting = false;
      }
    }, SCAN_EVERY_MS);
  }

  private open(code: string): void {
    this.busy.set(true);
    this.error.set(null);
    this.logistics.openReceptionByManifest(code).subscribe({
      next: (reception) => {
        this.busy.set(false);
        void this.router.navigate(['/reception', reception.dispatchId]);
      },
      error: (err: unknown) => {
        const apiError = toApiError(err);
        this.busy.set(false);
        this.error.set(
          apiError.status === 404
            ? 'No encontramos un despacho con ese código para tus obras. Revisa el código del manifiesto.'
            : apiError.message,
        );
      },
    });
  }
}
