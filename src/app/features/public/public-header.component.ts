import {ChangeDetectionStrategy, Component} from '@angular/core';
import {RouterLink} from '@angular/router';

/** Enlaces a las secciones de la página pública. */
export const PUBLIC_SECTIONS: readonly {readonly id: string; readonly label: string}[] = [
  {id: 'problema', label: 'Problema'},
  {id: 'solucion', label: 'Solución'},
  {id: 'planes', label: 'Planes'},
  {id: 'nosotros', label: 'Nosotros'},
];

/**
 * Barra superior de las páginas públicas (US49, US50): marca, secciones de la
 * página de inicio, ingreso y acceso a la prueba gratuita. Incluye el enlace
 * «Saltar al contenido», que lleva el foco al `main#contenido` de la página.
 */
@Component({
  selector: 'app-public-header',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip-link" href="#contenido" (click)="skipToContent($event)">Saltar al contenido</a>
    <header class="pub-header">
      <div class="pub-header-inner">
        <a class="brand" routerLink="/" aria-label="BuildShield, página de inicio">
          <img src="brand/mark-reverse.svg" alt="" width="32" height="32" />
          <span class="wordmark">BuildShield</span>
        </a>
        <nav class="sections" aria-label="Secciones de la página">
          @for (section of sections; track section.id) {
            <a routerLink="/" [fragment]="section.id">{{ section.label }}</a>
          }
        </nav>
        <div class="header-actions">
          <a class="signin" routerLink="/sign-in">Iniciar sesión</a>
          <a class="btn btn-signal trial" routerLink="/sign-up">Prueba gratuita</a>
        </div>
      </div>
    </header>
  `,
  styles: `
    :host {
      display: block;
    }

    .pub-header {
      position: sticky;
      top: 0;
      z-index: 30;
      background: var(--bs-asfalto);
      color: var(--bs-concreto);
      border-bottom: 3px solid var(--bs-senal);
    }

    .pub-header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px 24px;
      max-width: 1180px;
      min-height: 64px;
      margin: 0 auto;
      padding: 0 16px;

      @media (min-width: 900px) {
        padding: 0 40px;
      }
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-height: var(--bs-touch);
      color: var(--bs-concreto);
      text-decoration: none;
      border-radius: var(--bs-radius-control);
    }

    .wordmark {
      font-family: var(--bs-font-display);
      font-weight: 800;
      font-size: 1.5rem;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      line-height: 1;
    }

    .sections {
      display: none;
      gap: 4px;

      @media (min-width: 900px) {
        display: flex;
      }

      a {
        display: inline-flex;
        align-items: center;
        min-height: var(--bs-touch);
        padding: 0 12px;
        color: var(--bs-concreto);
        font-weight: 500;
        text-decoration: none;
        border-radius: var(--bs-radius-control);

        &:hover {
          background: var(--bs-asfalto-2);
        }
      }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .signin {
      display: inline-flex;
      align-items: center;
      min-height: var(--bs-touch);
      padding: 0 12px;
      color: var(--bs-concreto);
      font-weight: 600;
      text-decoration: none;
      border-radius: var(--bs-radius-control);

      &:hover {
        background: var(--bs-asfalto-2);
      }
    }

    .trial {
      display: none;

      @media (min-width: 520px) {
        display: inline-flex;
      }
    }

    a:focus-visible {
      box-shadow: 0 0 0 2px var(--bs-senal);
    }
  `,
})
export class PublicHeaderComponent {
  protected readonly sections = PUBLIC_SECTIONS;

  /**
   * Con `<base href="/">` un `href="#contenido"` llevaría a la raíz; por eso el
   * enlace mueve el foco al contenido de la página actual.
   */
  protected skipToContent(event: Event): void {
    const main = document.getElementById('contenido');
    if (!main) {
      return;
    }
    event.preventDefault();
    main.focus();
    main.scrollIntoView();
  }
}
