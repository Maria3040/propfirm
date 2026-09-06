import type { Response } from 'express';
import { settings } from '../config';

const MAX_AGE_MS = 8 * 60 * 60 * 1000;

export function setAuthCookie(res: Response, accessToken: string) {
  res.cookie(settings.authCookieName, accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(settings.authCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}
