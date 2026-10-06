import {InjectionToken} from '@angular/core';

import {environment} from '../../../environments/environment';
import {Environment} from '../../../environments/environment.model';

/** Configuración del entorno inyectable (las pruebas la reemplazan). */
export const APP_ENV = new InjectionToken<Environment>('APP_ENV', {
  providedIn: 'root',
  factory: () => environment,
});
