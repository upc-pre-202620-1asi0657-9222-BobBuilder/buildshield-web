import {TestBed} from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {of} from 'rxjs';

import {routes} from '../../app.routes';
import {FALLBACK_PLANS, PublicPlansService} from '../../core/api/public-plans.service';
import {AuthService} from '../../core/auth/auth.service';
import {Role} from '../../core/models/role';

function setup(session: Role | null) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      {
        provide: AuthService,
        useValue: {isAuthenticated: () => session !== null, role: () => session, hasAnyRole: () => true},
      },
      {
        provide: PublicPlansService,
        useValue: {catalog: () => of({plans: FALLBACK_PLANS, source: 'fallback'})},
      },
    ],
  });
}

describe('Rutas públicas (US49, US50)', () => {
  it('un visitante sin sesión ve la página pública en la raíz', async () => {
    setup(null);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');

    expect(TestBed.inject(Router).url).toBe('/');
    expect(harness.routeNativeElement?.querySelector('#hero-title')).not.toBeNull();
  });

  it('un usuario con sesión que entra a la raíz va al panel de su rol', () => {
    setup('WAREHOUSE_MANAGER');
    const root = routes.find((route) => route.path === '' && route.pathMatch === 'full')!;
    const guard = root.canActivate![0] as CanActivateFn;
    const result = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {url: '/'} as RouterStateSnapshot),
    );

    expect(result instanceof UrlTree ? result.toString() : result).toBe('/dispatches');
  });

  it('términos y privacidad se abren con o sin sesión', async () => {
    setup('SITE_MANAGER');
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/terminos');
    expect(TestBed.inject(Router).url).toBe('/terminos');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Términos');

    await harness.navigateByUrl('/privacidad');
    expect(TestBed.inject(Router).url).toBe('/privacidad');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('privacidad');
  });

  it('una ruta desconocida lleva a la página pública', async () => {
    setup(null);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/no-existe');

    expect(TestBed.inject(Router).url).toBe('/');
  });
});
