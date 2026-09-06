import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { settings } from './config';
import { ensureDatabase } from './persistence/ensure-database';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';

async function bootstrap() {
  await ensureDatabase();
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (!req.headers.authorization) {
      const token = req.cookies?.[settings.authCookieName];
      if (typeof token === 'string' && token) {
        req.headers.authorization = `Bearer ${token}`;
      }
    }
    next();
  });
  const corsOrigins = settings.corsOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  });
  await app.listen(settings.httpPort, '0.0.0.0');
  console.log(`PropFirm API listening on http://localhost:${settings.httpPort}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
