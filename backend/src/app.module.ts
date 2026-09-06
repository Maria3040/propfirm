import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { parseDatabaseUrl, settings } from './config';
import { ALL_ENTITIES } from './persistence/entities';
import { AppRuntime } from './infrastructure/app-runtime';
import { ApiController } from './api/api.controller';
import { MetricsController } from './api/metrics.controller';
import { GqlApiModule } from './graphql/gql-api.module';

const db = parseDatabaseUrl(settings.databaseUrl);

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: db.host,
      port: db.port,
      username: db.username,
      password: db.password,
      database: db.database,
      entities: ALL_ENTITIES,
      synchronize: true,
      logging: false,
    }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
    JwtModule.register({ secret: settings.jwtKey }),
    GqlApiModule,
  ],
  controllers: [ApiController, MetricsController],
  providers: [AppRuntime],
})
export class AppModule {}
