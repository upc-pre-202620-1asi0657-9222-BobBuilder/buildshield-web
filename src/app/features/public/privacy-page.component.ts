import {ChangeDetectionStrategy, Component, OnInit, inject} from '@angular/core';
import {Meta} from '@angular/platform-browser';
import {RouterLink} from '@angular/router';

import {LEGAL_CONTACT_EMAIL, LEGAL_UPDATED_AT} from './public-content';
import {PublicFooterComponent} from './public-footer.component';
import {PublicHeaderComponent} from './public-header.component';

export const PRIVACY_DESCRIPTION =
  'Política de tratamiento de datos personales de BuildShield conforme a la Ley N.º 29733: ' +
  'qué datos se tratan, para qué, con quién se comparten y cómo ejercer sus derechos.';

const PRIVACY_SECTIONS = [
  {id: 'titular', title: 'Titular y marco legal'},
  {id: 'roles', title: 'Quién decide sobre los datos'},
  {id: 'datos', title: 'Datos que tratamos'},
  {id: 'finalidades', title: 'Finalidades'},
  {id: 'base', title: 'Base para el tratamiento'},
  {id: 'pagos', title: 'Pagos y datos de tarjeta'},
  {id: 'terceros', title: 'Encargados y flujo transfronterizo'},
  {id: 'conservacion', title: 'Conservación'},
  {id: 'seguridad', title: 'Seguridad'},
  {id: 'derechos', title: 'Sus derechos'},
  {id: 'navegador', title: 'Almacenamiento en el navegador'},
  {id: 'cambios', title: 'Cambios en esta política'},
] as const;

/** T84 (US50): política de tratamiento de datos personales (Ley N.º 29733). */
@Component({
  selector: 'app-privacy-page',
  standalone: true,
  imports: [RouterLink, PublicHeaderComponent, PublicFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-public-header />
    <main id="contenido" tabindex="-1">
      <article class="legal" aria-labelledby="privacy-title">
        <header class="legal-head">
          <h1 id="privacy-title">Política de privacidad</h1>
          <p>
            Cómo BuildShield trata los datos personales de las organizaciones que lo usan y de sus
            usuarios, conforme a la Ley N.º 29733, Ley de Protección de Datos Personales, y su
            Reglamento.
          </p>
          <p class="updated">Última actualización: {{ updatedAt }}</p>
        </header>

        <nav class="toc" aria-labelledby="privacy-toc">
          <h2 id="privacy-toc">Contenido</h2>
          <ol>
            @for (section of sections; track section.id) {
              <li><a [routerLink]="[]" [fragment]="section.id">{{ section.title }}</a></li>
            }
          </ol>
        </nav>

        <div class="legal-body">
          <section id="titular">
            <h2>1. Titular y marco legal</h2>
            <p>
              BuildShield es un servicio de BobBuilder, con domicilio en Lima, Perú. Esta política
              se rige por la Ley N.º 29733, Ley de Protección de Datos Personales, y su Reglamento,
              aprobado por Decreto Supremo N.º 016-2024-JUS. BobBuilder inscribe sus bancos de datos
              personales ante el Registro Nacional de Protección de Datos Personales cuando la norma
              lo exige.
            </p>
          </section>

          <section id="roles">
            <h2>2. Quién decide sobre los datos</h2>
            <ul>
              <li>
                Para los datos de registro de la organización y de su administrador, BobBuilder es
                el titular del banco de datos y responsable del tratamiento.
              </li>
              <li>
                Para los datos que la organización carga sobre su personal y sus operaciones, como
                usuarios, transportistas, despachos y recepciones, la organización es la
                responsable y BobBuilder actúa como encargado del tratamiento: solo los trata para
                prestar el servicio y según las instrucciones de la organización.
              </li>
            </ul>
          </section>

          <section id="datos">
            <h2>3. Datos que tratamos</h2>
            <ul>
              <li>
                <strong>Registro de la organización</strong>: razón social, RUC, nombre y correo del
                administrador.
              </li>
              <li>
                <strong>Usuarios</strong>: nombre, correo, rol, obras o almacenes asignados y la
                contraseña, que se guarda solo como un resumen cifrado e irreversible.
              </li>
              <li>
                <strong>Operación</strong>: pedidos, despachos, pesajes, datos del transportista que
                registre el almacén, recepciones, discrepancias y las fotos de evidencia que suban los
                usuarios.
              </li>
              <li>
                <strong>Auditoría</strong>: qué usuario hizo cada acción y cuándo.
              </li>
              <li>
                <strong>Suscripción</strong>: plan, período, estado y comprobantes de pago.
              </li>
            </ul>
            <p>
              BuildShield no recoge la ubicación de los usuarios ni de los vehículos, y no trata
              datos sensibles.
            </p>
          </section>

          <section id="finalidades">
            <h2>4. Finalidades</h2>
            <ul>
              <li>Crear y administrar la cuenta de la organización y sus usuarios.</li>
              <li>Registrar despachos y recepciones, conciliarlos y calcular la merma.</li>
              <li>Abrir y dar seguimiento a las discrepancias.</li>
              <li>Mantener el historial de custodia y el registro de auditoría.</li>
              <li>Enviar avisos del servicio por correo, como despachos en camino o discrepancias.</li>
              <li>Gestionar la suscripción y sus cobros.</li>
              <li>Atender consultas y solicitudes de los titulares de datos.</li>
            </ul>
            <p>Los datos no se usan para publicidad ni se venden a terceros.</p>
          </section>

          <section id="base">
            <h2>5. Base para el tratamiento</h2>
            <p>
              Tratamos estos datos porque son necesarios para preparar, celebrar y ejecutar el
              contrato de servicio con la organización, supuesto en el que la Ley N.º 29733 no exige
              un consentimiento adicional. Para cualquier otra finalidad pediremos su consentimiento
              previo, libre, expreso e informado.
            </p>
          </section>

          <section id="pagos">
            <h2>6. Pagos y datos de tarjeta</h2>
            <p>
              Los pagos los procesa Stripe. Los datos de la tarjeta se ingresan directamente en
              Stripe y BuildShield no los recibe ni los guarda. De Stripe solo recibimos la
              confirmación del pago y un identificador del cliente.
            </p>
          </section>

          <section id="terceros">
            <h2>7. Encargados y flujo transfronterizo</h2>
            <p>Para prestar el servicio usamos estos proveedores, que tratan datos por encargo nuestro:</p>
            <ul>
              <li><strong>Stripe</strong>: procesamiento de pagos.</li>
              <li><strong>SendGrid</strong>: envío de correos del servicio.</li>
              <li><strong>Amazon Web Services</strong>: alojamiento y archivo de fotos de evidencia.</li>
            </ul>
            <p>
              Estos proveedores pueden almacenar datos fuera del Perú. Ese flujo transfronterizo se
              realiza con proveedores que ofrecen niveles de protección adecuados, conforme a la Ley
              N.º 29733. No compartimos datos con otras organizaciones usuarias ni con terceros
              distintos, salvo mandato de una autoridad competente.
            </p>
          </section>

          <section id="conservacion">
            <h2>8. Conservación</h2>
            <p>
              Conservamos los datos mientras la organización mantenga su cuenta. Si la cuenta se
              cierra, los eliminamos o anonimizamos, salvo los que debamos conservar por obligaciones
              legales o tributarias y solo por el plazo que estas exijan. Una cuenta en solo lectura
              conserva sus datos.
            </p>
          </section>

          <section id="seguridad">
            <h2>9. Seguridad</h2>
            <ul>
              <li>Conexiones cifradas entre el navegador y el servicio.</li>
              <li>Contraseñas guardadas solo como resumen cifrado.</li>
              <li>Acceso por rol: cada usuario ve solo lo que su rol permite.</li>
              <li>Separación por organización: ninguna organización ve los datos de otra.</li>
              <li>Registro de auditoría de solo anexado, que no se modifica ni se borra.</li>
            </ul>
          </section>

          <section id="derechos">
            <h2>10. Sus derechos</h2>
            <p>
              Como titular de datos personales puede ejercer sus derechos de información, acceso,
              rectificación, cancelación y oposición. Escriba a
              <a [href]="'mailto:' + contactEmail">{{ contactEmail }}</a> indicando su nombre, la
              organización a la que pertenece, el derecho que desea ejercer y una copia de su
              documento de identidad. Responderemos dentro de los plazos que fija el Reglamento.
            </p>
            <p>
              Si los datos los cargó su empleador, también puede dirigirse al administrador de su
              organización. Si considera que su solicitud no fue atendida, puede presentar un reclamo
              ante la Autoridad Nacional de Protección de Datos Personales del Ministerio de Justicia
              y Derechos Humanos.
            </p>
          </section>

          <section id="navegador">
            <h2>11. Almacenamiento en el navegador</h2>
            <p>
              BuildShield guarda en el almacenamiento local del navegador solo lo necesario para
              mantener la sesión iniciada. No usa cookies de publicidad ni de seguimiento.
            </p>
          </section>

          <section id="cambios">
            <h2>12. Cambios en esta política</h2>
            <p class="legal-foot">
              Si esta política cambia, publicaremos la nueva versión en esta página con su fecha y
              avisaremos a los administradores. Consulte también los
              <a routerLink="/terminos">Términos del servicio</a>.
            </p>
          </section>
        </div>
      </article>
    </main>
    <app-public-footer />
  `,
  styleUrl: './legal-page.scss',
})
export class PrivacyPageComponent implements OnInit {
  private readonly meta = inject(Meta);

  protected readonly sections = PRIVACY_SECTIONS;
  protected readonly updatedAt = LEGAL_UPDATED_AT;
  protected readonly contactEmail = LEGAL_CONTACT_EMAIL;

  ngOnInit(): void {
    this.meta.updateTag({name: 'description', content: PRIVACY_DESCRIPTION});
  }
}
