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

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await waitUntilReady(auth);
  const user = auth.user();
  if (!user) return true;
  if (user.role === 'Admin') return router.createUrlTree(['/admin']);
  return router.createUrlTree(['/accounts']);
};
