import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { MembershipRole, type Prisma } from "@sistema-erp/database";

import { DatabaseService } from "../database/database.service.js";
import { IdempotencyService } from "../idempotency/idempotency.service.js";
import { RequestContextService } from "../request-context/request-context.service.js";
import type {
  AddMembershipResponseDto,
  MembershipDto,
  OrganizationDto,
} from "./organizations.dto.js";

type AddMembershipInput = { email: string; role: MembershipRole };

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService,
  ) {}

  async getCurrent(): Promise<OrganizationDto> {
    const { organizationId } = this.requestContext.getAuthenticated();

    return this.database.value.organization.findUniqueOrThrow({
      select: { id: true, name: true, slug: true },
      where: { id: organizationId },
    });
  }

  async listMemberships(): Promise<MembershipDto[]> {
    const { organizationId } = this.requestContext.getAuthenticated();
    const memberships = await this.database.value.membership.findMany({
      include: { user: true },
      orderBy: { createdAt: "asc" },
      where: { organizationId },
    });

    return memberships.map(({ id, role, status, user, userId }) => ({
      email: user.email,
      id,
      name: user.name,
      role,
      status,
      userId,
    }));
  }

  async addMembership(input: AddMembershipInput, key: string): Promise<AddMembershipResponseDto> {
    const context = this.requestContext.getAuthenticated();

    if (context.role !== MembershipRole.OWNER && input.role === MembershipRole.ADMIN) {
      throw new ForbiddenException();
    }

    const normalizedInput = { email: input.email.trim().toLowerCase(), role: input.role };
    const result = await this.idempotency.execute({
      key,
      operation: "organizations.memberships.create",
      request: normalizedInput,
      run: async (transaction) => this.createMembership(transaction, normalizedInput),
    });

    return { membership: result.data as unknown as MembershipDto, replayed: result.replayed };
  }

  private async createMembership(
    transaction: Prisma.TransactionClient,
    input: AddMembershipInput,
  ): Promise<Prisma.JsonObject> {
    const context = this.requestContext.getAuthenticated();
    const user = await transaction.user.findUnique({ where: { email: input.email } });

    if (!user) {
      throw new NotFoundException();
    }

    const existing = await transaction.membership.findUnique({
      where: {
        organizationId_userId: { organizationId: context.organizationId, userId: user.id },
      },
    });

    if (existing) {
      throw new ConflictException();
    }

    const membership = await transaction.membership.create({
      data: {
        organizationId: context.organizationId,
        role: input.role,
        userId: user.id,
      },
    });
    const response: Prisma.JsonObject = {
      email: user.email,
      id: membership.id,
      name: user.name,
      role: membership.role,
      status: membership.status,
      userId: membership.userId,
    };

    await transaction.auditEvent.create({
      data: {
        action: "organizations.membership.created",
        actorUserId: context.userId,
        correlationId: context.correlationId,
        entityId: membership.id,
        entityType: "membership",
        metadata: { assignedRole: membership.role },
        organizationId: context.organizationId,
        requestId: context.requestId,
      },
    });

    return response;
  }
}
