import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

async function waitUntilReady(auth: AuthService) {
  if (auth.ready()) return;
  // Bootstrap may still be in flight from App init.
  await new Promise<void>((resolve) => {
    const id = setInterval(() => {
      if (auth.ready()) {
        clearInterval(id);
        resolve();
      }
    }, 20);
  });
}

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await waitUntilReady(auth);
  if (auth.user()) return true;
  return router.createUrlTree(['/login'], {
    queryParams: { next: state.url },
  });
};
