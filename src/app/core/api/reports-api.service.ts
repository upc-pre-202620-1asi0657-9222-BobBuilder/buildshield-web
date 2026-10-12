import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable, map} from 'rxjs';

import {APP_ENV} from '../config/app-env';
import {DownloadedFile, ExportFormat, ReconciliationReport, ReportQuery} from '../models/report';

function toParams(query: ReportQuery, extra: Record<string, string> = {}): HttpParams {
  let params = new HttpParams({fromObject: extra});
  for (const [key, value] of Object.entries(query)) {
    if (value) {
      params = params.set(key, value);
    }
  }
  return params;
}

/**
 * Nombre del archivo desde `Content-Disposition` (`filename*=UTF-8''...` o
 * `filename="..."`); si el header no llega, uno por defecto.
 */
export function fileNameFrom(disposition: string | null, fallback: string): string {
  if (!disposition) {
    return fallback;
  }
  const encoded = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(disposition);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim().replace(/^"|"$/g, ''));
    } catch {
      // Sigue con filename=.
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1].trim() : fallback;
}

/** US47 y US48: reporte de conciliación y su exportación. */
@Injectable({providedIn: 'root'})
export class ReportsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_ENV).apiBaseUrl}/audit/reports/reconciliation`;

  reconciliation(query: ReportQuery): Observable<ReconciliationReport> {
    return this.http.get<ReconciliationReport>(this.base, {params: toParams(query)});
  }

  export(query: ReportQuery, format: ExportFormat): Observable<DownloadedFile> {
    return this.http
      .get(`${this.base}/export`, {
        params: toParams(query, {format}),
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(
        map((response) => ({
          fileName: fileNameFrom(response.headers.get('Content-Disposition'), `conciliacion.${format}`),
          blob: response.body ?? new Blob([]),
        })),
      );
  }
}
