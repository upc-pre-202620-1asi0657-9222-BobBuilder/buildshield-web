import {Injectable} from '@angular/core';

/** Guarda un archivo descargado con un enlace temporal. Inyectable para las pruebas. */
@Injectable({providedIn: 'root'})
export class FileSaver {
  save(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
