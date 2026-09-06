import { ArgsType, Field } from '@nestjs/graphql';

@ArgsType()
export class LoginArgs {
  @Field()
  email!: string;

  @Field()
  password!: string;

  @Field({ nullable: true })
  clientIp?: string;
}

@ArgsType()
export class ProductsArgs {
  @Field({ nullable: true })
  phaseFamily?: string;

  @Field({ nullable: true })
  variant?: string;
}
