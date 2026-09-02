import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { type PartnerRole, type PartnerType, type Prisma } from "@sistema-erp/database";

import { DatabaseService } from "../database/database.service.js";
import { IdempotencyService } from "../idempotency/idempotency.service.js";
import { RequestContextService } from "../request-context/request-context.service.js";
import type {
  CreatePartnerResponseDto,
  PartnerDto,
  PartnerListResponseDto,
} from "./partners.dto.js";
import { normalizeTaxId } from "./tax-id.js";

function searchFilters(search: string): Prisma.PartnerWhereInput[] {
  const normalizedTaxId = normalizeTaxId(search);
  const filters: Prisma.PartnerWhereInput[] = [
    { legalName: { contains: search, mode: "insensitive" } },
    { tradeName: { contains: search, mode: "insensitive" } },
  ];

  if (normalizedTaxId.length > 0) {
    filters.push({ taxId: { contains: normalizedTaxId } });
  }

  return filters;
}

type ListPartnersInput = {
  active?: boolean;
  limit: number;
  offset: number;
  role?: PartnerRole;
  search?: string;
};

type PersistedPartner = {
  active: boolean;
  id: string;
  legalName: string;
  roles: PartnerRole[];
  taxId: string;
  tradeName: string | null;
  type: PartnerType;
};

function toPartnerDto(partner: PersistedPartner): PartnerDto {
  return {
    active: partner.active,
    id: partner.id,
    legalName: partner.legalName,
    roles: partner.roles,
    taxId: partner.taxId,
    ...(partner.tradeName ? { tradeName: partner.tradeName } : {}),
    type: partner.type,
  };
}

type CreatePartnerInput = {
  legalName: string;
  roles: PartnerRole[];
  taxId: string;
  tradeName?: string;
  type: PartnerType;
};

@Injectable()
export class PartnersService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService,
  ) {}

  async list(input: ListPartnersInput): Promise<PartnerListResponseDto> {
    const { organizationId } = this.requestContext.getAuthenticated();
    const where: Prisma.PartnerWhereInput = {
      organizationId,
      ...(input.active === undefined ? {} : { active: input.active }),
      ...(input.role ? { roles: { has: input.role } } : {}),
      ...(input.search ? { OR: searchFilters(input.search) } : {}),
    };
    const [partners, total] = await Promise.all([
      this.database.value.partner.findMany({
        orderBy: [{ legalName: "asc" }, { id: "asc" }],
        skip: input.offset,
        take: input.limit,
        where,
      }),
      this.database.value.partner.count({ where }),
    ]);

    return {
      items: partners.map(toPartnerDto),
      limit: input.limit,
      offset: input.offset,
      total,
    };
  }

  async findById(id: string): Promise<PartnerDto> {
    const { organizationId } = this.requestContext.getAuthenticated();
    const partner = await this.database.value.partner.findUnique({
      where: { id_organizationId: { id, organizationId } },
    });

    if (!partner) {
      throw new NotFoundException();
    }

    return toPartnerDto(partner);
  }

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
