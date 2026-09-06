import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { settings } from './config';
import { ensureDatabase } from './persistence/ensure-database';

async function bootstrap() {
  await ensureDatabase();
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: settings.corsOrigin, credentials: true });
  await app.listen(settings.httpPort, '0.0.0.0');
  console.log(`PropFirm API listening on http://localhost:${settings.httpPort}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
