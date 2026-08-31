import { randomBytes } from "node:crypto";

import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";

import { DatabaseService } from "../database/database.service.js";
import { RequestContextService } from "../request-context/request-context.service.js";
import { hashSessionToken } from "./authentication.guard.js";
import type { CreateSessionResponseDto } from "./auth.dto.js";
import { LoginRateLimiterService } from "./login-rate-limiter.service.js";
import { verifyPassword } from "./password.js";

const SESSION_TTL_MILLISECONDS = 8 * 60 * 60 * 1_000;
const DUMMY_PASSWORD_HASH =
  "scrypt$00000000000000000000000000000000$d5f6e00464bd575a5520eb7e75c52335906fa07f8a74850d2050fecd6452e561d8f3b57dc15c5714dc0f0130042e7a93b630ab181b0f657c17bc39272e4b9960";

type LoginInput = { email: string; organizationSlug: string; password: string };

@Injectable()
export class AuthService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(LoginRateLimiterService) private readonly loginRateLimiter: LoginRateLimiterService,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService,
  ) {}

  async createSession(input: LoginInput): Promise<CreateSessionResponseDto> {
    const email = input.email.trim().toLowerCase();
    const organizationSlug = input.organizationSlug.trim().toLowerCase();
    const attemptKey = `${organizationSlug}:${email}`;

    this.loginRateLimiter.assertAllowed(attemptKey);

    const membership = await this.database.value.membership.findFirst({
      include: { organization: true, user: true },
      where: {
        organization: { slug: organizationSlug },
        status: "ACTIVE",
        user: { email },
      },
    });

    const passwordMatches = await verifyPassword(
      input.password,
      membership?.user.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!membership || !passwordMatches) {
      this.loginRateLimiter.recordFailure(attemptKey);
      throw new UnauthorizedException();
    }

    this.loginRateLimiter.reset(attemptKey);

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MILLISECONDS);
    const context = this.requestContext.get();

    if (!context) {
      throw new Error("Request context is unavailable");
    }

    await this.database.value.$transaction(async (transaction) => {
      const session = await transaction.session.create({
        data: {
          expiresAt,
          membershipId: membership.id,
          tokenHash: hashSessionToken(token),
          userId: membership.userId,
        },
      });

      await transaction.auditEvent.create({
        data: {
          action: "identity.session.created",
          actorUserId: membership.userId,
          correlationId: context.correlationId,
          entityId: session.id,
          entityType: "session",
          metadata: {},
          organizationId: membership.organizationId,
          requestId: context.requestId,
        },
      });
    });

    return {
      expiresAt: expiresAt.toISOString(),
      organizationId: membership.organizationId,
      role: membership.role,
      token,
      userId: membership.userId,
    };
  }

  async revokeCurrentSession(rawToken: string): Promise<void> {
    const context = this.requestContext.getAuthenticated();
    const session = await this.database.value.session.findUniqueOrThrow({
      where: { tokenHash: hashSessionToken(rawToken) },
    });

    await this.database.value.$transaction([
      this.database.value.session.update({
        data: { revokedAt: new Date() },
        where: { id: session.id },
      }),
      this.database.value.auditEvent.create({
        data: {
          action: "identity.session.revoked",
          actorUserId: context.userId,
          correlationId: context.correlationId,
          entityId: session.id,
          entityType: "session",
          metadata: {},
          organizationId: context.organizationId,
          requestId: context.requestId,
        },
      }),
    ]);
  }
}
