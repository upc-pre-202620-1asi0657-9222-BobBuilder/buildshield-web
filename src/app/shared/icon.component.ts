import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';

/**
 * Íconos de trazo (geometría de Lucide, licencia ISC) dibujados en línea para no
 * sumar dependencias. Son decorativos: el texto vecino da el nombre accesible.
 */
const PATHS: Record<string, string> = {
  reception: 'm16 17 2 2 4-4M21 10V8l-9-5-9 5v8l9 5 1-.6M3 8l9 5 9-5M12 13v8',
  orders: 'M9 3h6v3H9zM6 5H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1M8 12h8M8 16h5',
  dispatches: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  stock: 'M3 21V9l9-6 9 6v12M7 21v-8h10v8M7 17h10',
  users: 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  worksites: 'M2 20h20M5 20V9l7-5 7 5v11M9 20v-6h6v6',
  warehouses: 'M22 8.4V20a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8.4a2 2 0 0 1 1.2-1.8l8-3.5a2 2 0 0 1 1.6 0l8 3.5A2 2 0 0 1 22 8.4M6 18h12M6 14h12',
  materials: 'm12 2 10 5-10 5L2 7zM2 12l10 5 10-5M2 17l10 5 10-5',
  'sign-out': 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M18 6 6 18M6 6l12 12',
  back: 'm15 18-6-6 6-6',
  plus: 'M12 5v14M5 12h14',
  check: 'M20 6 9 17l-5-5',
  print: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  truck: 'M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.6a1 1 0 0 0-.2-.6l-3.5-4.4A1 1 0 0 0 17.5 8H14M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4M17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  scale: 'M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z',
  refresh: 'M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5',
};

@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {'aria-hidden': 'true', class: 'icon'},
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" focusable="false">
      <path [attr.d]="d()" />
    </svg>
  `,
  styles: `
    :host { display: inline-flex; width: 20px; height: 20px; flex: none; }
    svg { width: 100%; height: 100%; }
  `,
})
export class IconComponent {
  readonly name = input.required<string>();
  protected readonly d = computed(() => PATHS[this.name()] ?? '');
}
