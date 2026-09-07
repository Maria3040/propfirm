import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

async function waitUntilReady(auth: AuthService) {
  if (auth.ready()) return;
  await new Promise<void>((resolve) => {
    const id = setInterval(() => {
      if (auth.ready()) {
        clearInterval(id);
        resolve();
      }
    }, 20);
  });
}

export const adminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await waitUntilReady(auth);
  const user = auth.user();
  if (!user) {
    return router.createUrlTree(['/login'], {
      queryParams: { next: state.url },
    });
  }
  if (user.role === 'Admin') return true;
  return router.createUrlTree(['/accounts']);
};
