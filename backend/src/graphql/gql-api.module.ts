import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { join } from 'path';
import { settings } from '../config';
import { ALL_ENTITIES } from '../persistence/entities';
import { PropFirmResolver } from './propfirm.resolver';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/graphql/schema.gql'),
      sortSchema: true,
      playground: true,
      path: '/graphql',
      context: ({ req }: { req: unknown }) => ({ req }),
    }),
    TypeOrmModule.forFeature(ALL_ENTITIES),
    JwtModule.register({ secret: settings.jwtKey }),
  ],
  providers: [PropFirmResolver],
})
export class GqlApiModule {}
