import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable} from 'rxjs';

import {APP_ENV} from '../config/app-env';

/** Usuario que puede recibir un aviso (copia local de notification-service). */
export interface RecipientUser {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  active: boolean;
}

/** Configuración de un tipo de aviso en una obra. */
export interface RecipientTypeSetting {
  type: string;
  label: string;
  /** false: se aplica la regla por rol de US43 (defaultAudience). */
  configured: boolean;
  defaultAudience: string;
  recipients: RecipientUser[];
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface WorksiteRecipientSettings {
  worksiteId: string;
  worksiteName: string | null;
  types: RecipientTypeSetting[];
  candidates: RecipientUser[];
}

/** T81 (US45): destinatarios por obra y tipo de aviso. Solo el administrador. */
@Injectable({providedIn: 'root'})
export class RecipientSettingsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_ENV).apiBaseUrl}/notifications/recipient-settings`;

  forWorksite(worksiteId: string): Observable<WorksiteRecipientSettings> {
    return this.http.get<WorksiteRecipientSettings>(`${this.base}/worksites/${worksiteId}`);
  }

  replace(worksiteId: string, type: string, userIds: string[]): Observable<RecipientTypeSetting> {
    return this.http.put<RecipientTypeSetting>(`${this.base}/worksites/${worksiteId}/types/${type}`, {userIds});
  }

  reset(worksiteId: string, type: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/worksites/${worksiteId}/types/${type}`);
  }
}
