import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { type PartnerRole, type PartnerType, type Prisma } from "@sistema-erp/database";

import { DatabaseService } from "../database/database.service.js";
import { IdempotencyService } from "../idempotency/idempotency.service.js";
import { RequestContextService } from "../request-context/request-context.service.js";
import type { CreatePartnerResponseDto, PartnerDto } from "./partners.dto.js";

type CreatePartnerInput = {
  legalName: string;
  roles: PartnerRole[];
  taxId: string;
  tradeName?: string;
  type: PartnerType;
};

export function normalizeTaxId(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[.\-/\s]/g, "");
}

@Injectable()
export class PartnersService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService,
  ) {}

  async create(input: CreatePartnerInput, key: string): Promise<CreatePartnerResponseDto> {
    const normalizedInput = {
      legalName: input.legalName.trim(),
      roles: [...new Set(input.roles)].sort(),
      taxId: normalizeTaxId(input.taxId),
      ...(input.tradeName?.trim() ? { tradeName: input.tradeName.trim() } : {}),
      type: input.type,
    };
    const result = await this.idempotency.execute({
      key,
      operation: "partners.create",
      request: normalizedInput,
      run: async (transaction) => this.createPartner(transaction, normalizedInput),
    });

    return { partner: result.data as unknown as PartnerDto, replayed: result.replayed };
  }

  private async createPartner(
    transaction: Prisma.TransactionClient,
    input: CreatePartnerInput,
  ): Promise<Prisma.JsonObject> {
    const context = this.requestContext.getAuthenticated();
    const existing = await transaction.partner.findUnique({
      where: {
        organizationId_taxId: { organizationId: context.organizationId, taxId: input.taxId },
      },
    });

    if (existing) {
      throw new ConflictException();
    }

    const partner = await transaction.partner.create({
      data: { ...input, organizationId: context.organizationId },
    });
    const response: Prisma.JsonObject = {
      active: partner.active,
      id: partner.id,
      legalName: partner.legalName,
      roles: partner.roles,
      taxId: partner.taxId,
      ...(partner.tradeName ? { tradeName: partner.tradeName } : {}),
      type: partner.type,
    };

    await transaction.auditEvent.create({
      data: {
        action: "partners.created",
        actorUserId: context.userId,
        correlationId: context.correlationId,
        entityId: partner.id,
        entityType: "partner",
        metadata: { roles: partner.roles, type: partner.type },
        organizationId: context.organizationId,
        requestId: context.requestId,
      },
    });

    return response;
  }
}
