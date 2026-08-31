import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { MembershipRole } from "@sistema-erp/database";

import { RequestContextService } from "../request-context/request-context.service.js";
import { ROLES_KEY } from "./roles.decorator.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService,
  ) {}

  canActivate(executionContext: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<MembershipRole[]>(ROLES_KEY, [
      executionContext.getHandler(),
      executionContext.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const context = this.requestContext.getAuthenticated();

    if (!requiredRoles.includes(context.role)) {
      throw new ForbiddenException();
    }

    return true;
  }
}
