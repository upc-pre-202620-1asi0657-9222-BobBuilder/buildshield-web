import {Provider, inject} from '@angular/core';

import {APP_ENV} from '../config/app-env';
import {HttpLogisticsApi} from './http-logistics-api';
import {LogisticsApi} from './logistics-api';
import {MockLogisticsApi} from './mock-logistics-api';

/** Elige la implementación de despachos y recepciones según environment.mockSprint2. */
export function provideLogisticsApi(): Provider[] {
  return [
    HttpLogisticsApi,
    MockLogisticsApi,
    {
      provide: LogisticsApi,
      useFactory: (): LogisticsApi =>
        inject(APP_ENV).mockSprint2 ? inject(MockLogisticsApi) : inject(HttpLogisticsApi),
    },
  ];
}
