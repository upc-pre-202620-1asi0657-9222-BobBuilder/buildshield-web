import {ChangeDetectionStrategy, Component} from '@angular/core';
import {RouterLink} from '@angular/router';

/** Pie de las páginas públicas con los enlaces legales (US50). */
@Component({
  selector: 'app-public-footer',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="pub-footer">
      <div class="pub-footer-inner">
        <div class="about">
          <span class="brand">
            <img src="brand/mark-reverse.svg" alt="" width="28" height="28" />
            <span class="wordmark">BuildShield</span>
          </span>
          <p>Trazabilidad de materiales entre almacén y obra. Un producto de BobBuilder.</p>
        </div>
        <nav aria-label="Enlaces legales y de cuenta">
          <ul class="links">
            <li><a routerLink="/terminos">Términos del servicio</a></li>
            <li><a routerLink="/privacidad">Política de privacidad</a></li>
            <li><a routerLink="/sign-in">Iniciar sesión</a></li>
            <li><a routerLink="/sign-up">Registrar organización</a></li>
          </ul>
        </nav>
      </div>
      <p class="legal-line">
        © {{ year }} BobBuilder. Proyecto académico de Ingeniería de Software, UPC, Lima, Perú.
      </p>
    </footer>
  `,
  styles: `
    :host {
      display: block;
    }

    .pub-footer {
      background: var(--bs-asfalto);
      color: var(--bs-concreto);
      padding: 40px 16px 24px;

      @media (min-width: 900px) {
        padding: 48px 40px 28px;
      }
    }

    .pub-footer-inner {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 24px 48px;
      max-width: 1100px;
      margin: 0 auto;
    }

    .about {
      max-width: 40ch;

      p {
        margin: 12px 0 0;
        color: var(--bs-niebla);
      }
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }

    .wordmark {
      font-family: var(--bs-font-display);
      font-weight: 800;
      font-size: 1.35rem;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      line-height: 1;
    }

    .links {
      display: grid;
      gap: 4px 32px;
      margin: 0;
      padding: 0;
      list-style: none;

      @media (min-width: 520px) {
        grid-template-columns: repeat(2, auto);
      }

      a {
        display: inline-flex;
        align-items: center;
        min-height: var(--bs-touch);
        color: var(--bs-concreto);
        font-weight: 500;
        text-decoration: underline;
        text-decoration-color: var(--bs-acero);
        border-radius: var(--bs-radius-control);

        &:hover {
          text-decoration-color: var(--bs-senal);
        }

        &:focus-visible {
          box-shadow: 0 0 0 2px var(--bs-senal);
        }
      }
    }

    .legal-line {
      max-width: 1100px;
      margin: 32px auto 0;
      padding-top: 20px;
      border-top: 1px solid var(--bs-asfalto-2);
      font-size: 0.875rem;
      color: var(--bs-niebla);
    }
  `,
})
export class PublicFooterComponent {
  protected readonly year = new Date().getFullYear();
}
