import {Provider, inject} from '@angular/core';

import {APP_ENV} from '../config/app-env';
import {HttpLogisticsApi} from './http-logistics-api';
import {LogisticsApi} from './logistics-api';
import {MockLogisticsApi} from './mock-logistics-api';
import {MockNotificationsApi} from './mock-notifications-api';
import {HttpNotificationsApi, NotificationsApi} from './notifications-api';

/**
 * Elige la implementación de despachos, recepciones, discrepancias y
 * notificaciones según environment.mockSprint2.
 */
export function provideLogisticsApi(): Provider[] {
  return [
    HttpLogisticsApi,
    MockLogisticsApi,
    {
      provide: LogisticsApi,
      useFactory: (): LogisticsApi =>
        inject(APP_ENV).mockSprint2 ? inject(MockLogisticsApi) : inject(HttpLogisticsApi),
    },
    HttpNotificationsApi,
    MockNotificationsApi,
    {
      provide: NotificationsApi,
      useFactory: (): NotificationsApi =>
        inject(APP_ENV).mockSprint2 ? inject(MockNotificationsApi) : inject(HttpNotificationsApi),
    },
  ];
}
