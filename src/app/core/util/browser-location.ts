import {Injectable} from '@angular/core';

/**
 * Redirección fuera de la aplicación (Stripe Checkout). Se inyecta para poder
 * reemplazarla en las pruebas sin recargar el navegador de Karma.
 */
@Injectable({providedIn: 'root'})
export class BrowserLocation {
  get origin(): string {
    return window.location.origin;
  }

  assign(url: string): void {
    window.location.assign(url);
  }
}
