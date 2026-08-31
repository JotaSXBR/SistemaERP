import { createHash } from "node:crypto";

import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";

import { DatabaseService } from "../database/database.service.js";
import { RequestContextService } from "../request-context/request-context.service.js";
import { IS_PUBLIC_KEY } from "./public.decorator.js";

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function readBearerToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }

  const token = authorization.slice("Bearer ".length).trim();

  return token || undefined;
}

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService,
  ) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      executionContext.getHandler(),
      executionContext.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = executionContext.switchToHttp().getRequest<FastifyRequest>();
    const token = readBearerToken(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    const session = await this.database.value.session.findUnique({
      include: { membership: true },
      where: { tokenHash: hashSessionToken(token) },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.membership.status !== "ACTIVE"
    ) {
      throw new UnauthorizedException();
    }

    this.requestContext.setIdentity({
      membershipId: session.membershipId,
      organizationId: session.membership.organizationId,
      role: session.membership.role,
      userId: session.userId,
    });

    await this.database.value.session.update({
      data: { lastUsedAt: new Date() },
      where: { id: session.id },
    });

    return true;
  }
}
