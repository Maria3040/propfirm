import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import { settings } from '../config';

export type GqlUser = { sub: string; email: string; role: string };

export function userFromAuthHeader(authorization: string | undefined, jwt: JwtService): GqlUser | null {
  if (!authorization?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authorization.slice(7).trim(), {
      secret: settings.jwtKey,
      audience: settings.jwtAudience,
      issuer: settings.jwtIssuer,
    }) as GqlUser;
  } catch {
    return null;
  }
}

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): GqlUser => {
  const ctx = GqlExecutionContext.create(context);
  const req = ctx.getContext().req as { headers?: { authorization?: string }; user?: GqlUser };
  if (req.user) return req.user;
  throw new UnauthorizedException('unauthorized');
});

export function requireUser(authorization: string | undefined, jwt: JwtService): GqlUser {
  const u = userFromAuthHeader(authorization, jwt);
  if (!u?.sub) throw new UnauthorizedException('unauthorized');
  return u;
}
