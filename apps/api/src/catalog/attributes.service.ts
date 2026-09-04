import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { type Prisma } from "@sistema-erp/database";

import { DatabaseService } from "../database/database.service.js";
import { IdempotencyService } from "../idempotency/idempotency.service.js";
import { RequestContextService } from "../request-context/request-context.service.js";
import type {
  CreateProductAttributeDefinitionResponseDto,
  CreateProductAttributeOptionResponseDto,
  ProductAttributeDefinitionDto,
  ProductAttributeDefinitionListResponseDto,
  ProductAttributeOptionDto,
  UpdateProductAttributeDefinitionResponseDto,
  UpdateProductAttributeOptionResponseDto,
} from "./attributes.dto.js";

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

type PersistedOption = {
  active: boolean;
  code: string;
  id: string;
  name: string;
};

type PersistedDefinition = {
  active: boolean;
  code: string;
  id: string;
  name: string;
  options?: PersistedOption[];
};

function optionResponse(option: PersistedOption): ProductAttributeOptionDto {
  return { active: option.active, code: option.code, id: option.id, name: option.name };
}

function definitionResponse(definition: PersistedDefinition): ProductAttributeDefinitionDto {
  return {
    active: definition.active,
    code: definition.code,
    id: definition.id,
    name: definition.name,
    options: (definition.options ?? []).map(optionResponse),
  };
}

/**
 * Eixos de classificação técnica e seus valores. Separado de `ClassificationService` porque resolve
 * outro problema: a taxonomia agrupa comercialmente, as facetas descrevem tecnicamente. Ver ADR-0010.
 */
@Injectable()
export class AttributesService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService,
  ) {}

  async listDefinitions(input: {
    active?: boolean;
  }): Promise<ProductAttributeDefinitionListResponseDto> {
    const { organizationId } = this.requestContext.getAuthenticated();
    const definitions = await this.database.value.productAttributeDefinition.findMany({
      include: {
        // Os eixos de um tenant são poucos, então trazer os valores junto evita uma consulta por
        // eixo e mantém a listagem utilizável para montar formulário de cadastro.
        options: {
          orderBy: [{ name: "asc" }, { id: "asc" }],
          ...(input.active === undefined ? {} : { where: { active: input.active } }),
        },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      where: {
        organizationId,
        ...(input.active === undefined ? {} : { active: input.active }),
      },
    });

    return { items: definitions.map(definitionResponse) };
  }

  async createDefinition(
    input: { code: string; name: string },
    key: string,
  ): Promise<CreateProductAttributeDefinitionResponseDto> {
    const normalizedInput = { code: normalizeCode(input.code), name: input.name.trim() };
    const result = await this.idempotency.execute({
      key,
      operation: "catalog.attributeDefinitions.create",
      request: normalizedInput,
      run: async (transaction) => this.createDefinitionTransaction(transaction, normalizedInput),
    });

    return {
      definition: result.data as unknown as ProductAttributeDefinitionDto,
      replayed: result.replayed,
    };
  }

  async updateDefinition(
    id: string,
    input: { active?: boolean; name?: string },
    key: string,
  ): Promise<UpdateProductAttributeDefinitionResponseDto> {
    const normalizedInput = {
      id,
      ...(input.active === undefined ? {} : { active: input.active }),
      ...(input.name === undefined ? {} : { name: input.name.trim() }),
    };
    const result = await this.idempotency.execute({
      key,
      operation: "catalog.attributeDefinitions.update",
      request: normalizedInput,
      responseStatus: 200,
      run: async (transaction) => this.updateDefinitionTransaction(transaction, normalizedInput),
    });

    return {
      definition: result.data as unknown as ProductAttributeDefinitionDto,
      replayed: result.replayed,
    };
  }

  async createOption(
    input: { code: string; definitionId: string; name: string },
    key: string,
  ): Promise<CreateProductAttributeOptionResponseDto> {
    const normalizedInput = {
      code: normalizeCode(input.code),
      definitionId: input.definitionId,
      name: input.name.trim(),
    };
    const result = await this.idempotency.execute({
      key,
      operation: "catalog.attributeOptions.create",
      request: normalizedInput,
      run: async (transaction) => this.createOptionTransaction(transaction, normalizedInput),
    });

    return {
      option: result.data as unknown as ProductAttributeOptionDto,
      replayed: result.replayed,
    };
  }

  async updateOption(
    id: string,
    input: { active?: boolean; name?: string },
    key: string,
  ): Promise<UpdateProductAttributeOptionResponseDto> {
    const normalizedInput = {
      id,
      ...(input.active === undefined ? {} : { active: input.active }),
      ...(input.name === undefined ? {} : { name: input.name.trim() }),
    };
    const result = await this.idempotency.execute({
      key,
      operation: "catalog.attributeOptions.update",
      request: normalizedInput,
      responseStatus: 200,
      run: async (transaction) => this.updateOptionTransaction(transaction, normalizedInput),
    });

    return {
      option: result.data as unknown as ProductAttributeOptionDto,
      replayed: result.replayed,
    };
  }

  private async createDefinitionTransaction(
    transaction: Prisma.TransactionClient,
    input: { code: string; name: string },
  ): Promise<Prisma.JsonObject> {
    const context = this.requestContext.getAuthenticated();
    const existing = await transaction.productAttributeDefinition.findUnique({
      where: { organizationId_code: { code: input.code, organizationId: context.organizationId } },
    });
    if (existing) {
      throw new ConflictException();
    }

    const definition = await transaction.productAttributeDefinition.create({
      data: { code: input.code, name: input.name, organizationId: context.organizationId },
    });

    await transaction.auditEvent.create({
      data: {
        action: "catalog.attributeDefinitions.created",
        actorUserId: context.userId,
        correlationId: context.correlationId,
        entityId: definition.id,
        entityType: "product_attribute_definition",
        metadata: { code: definition.code },
        organizationId: context.organizationId,
        requestId: context.requestId,
      },
    });

    return definitionResponse(definition) as unknown as Prisma.JsonObject;
  }

  private async updateDefinitionTransaction(
    transaction: Prisma.TransactionClient,
    input: { active?: boolean; id: string; name?: string },
  ): Promise<Prisma.JsonObject> {
    const context = this.requestContext.getAuthenticated();
    const where = { id_organizationId: { id: input.id, organizationId: context.organizationId } };
    const existing = await transaction.productAttributeDefinition.findUnique({ where });
    if (!existing) {
      throw new NotFoundException();
    }

    const definition = await transaction.productAttributeDefinition.update({
      data: {
        ...(input.active === undefined ? {} : { active: input.active }),
        ...(input.name === undefined ? {} : { name: input.name }),
      },
      include: { options: { orderBy: [{ name: "asc" }, { id: "asc" }] } },
      where,
    });

    await transaction.auditEvent.create({
      data: {
        action: "catalog.attributeDefinitions.updated",
        actorUserId: context.userId,
        correlationId: context.correlationId,
        entityId: definition.id,
        entityType: "product_attribute_definition",
        metadata: {
          activeChanged: input.active !== undefined && input.active !== existing.active,
          code: definition.code,
          nameChanged: input.name !== undefined && input.name !== existing.name,
        },
        organizationId: context.organizationId,
        requestId: context.requestId,
      },
    });

    return definitionResponse(definition) as unknown as Prisma.JsonObject;
  }

  private async createOptionTransaction(
    transaction: Prisma.TransactionClient,
    input: { code: string; definitionId: string; name: string },
  ): Promise<Prisma.JsonObject> {
    const context = this.requestContext.getAuthenticated();
    const definition = await transaction.productAttributeDefinition.findUnique({
      where: {
        id_organizationId: { id: input.definitionId, organizationId: context.organizationId },
      },
    });
    if (!definition) {
      throw new NotFoundException();
    }

    const existing = await transaction.productAttributeOption.findUnique({
      where: {
        organizationId_definitionId_code: {
          code: input.code,
          definitionId: input.definitionId,
          organizationId: context.organizationId,
        },
      },
    });
    if (existing) {
      throw new ConflictException();
    }

    const option = await transaction.productAttributeOption.create({
      data: {
        code: input.code,
        definitionId: input.definitionId,
        name: input.name,
        organizationId: context.organizationId,
      },
    });

    await transaction.auditEvent.create({
      data: {
        action: "catalog.attributeOptions.created",
        actorUserId: context.userId,
        correlationId: context.correlationId,
        entityId: option.id,
        entityType: "product_attribute_option",
        metadata: { code: option.code, definitionCode: definition.code },
        organizationId: context.organizationId,
        requestId: context.requestId,
      },
    });

    return optionResponse(option) as unknown as Prisma.JsonObject;
  }

  private async updateOptionTransaction(
    transaction: Prisma.TransactionClient,
    input: { active?: boolean; id: string; name?: string },
  ): Promise<Prisma.JsonObject> {
    const context = this.requestContext.getAuthenticated();
    const where = { id_organizationId: { id: input.id, organizationId: context.organizationId } };
    const existing = await transaction.productAttributeOption.findUnique({ where });
    if (!existing) {
      throw new NotFoundException();
    }

    const option = await transaction.productAttributeOption.update({
      data: {
        ...(input.active === undefined ? {} : { active: input.active }),
        ...(input.name === undefined ? {} : { name: input.name }),
      },
      where,
    });

    await transaction.auditEvent.create({
      data: {
        action: "catalog.attributeOptions.updated",
        actorUserId: context.userId,
        correlationId: context.correlationId,
        entityId: option.id,
        entityType: "product_attribute_option",
        metadata: {
          activeChanged: input.active !== undefined && input.active !== existing.active,
          code: option.code,
          nameChanged: input.name !== undefined && input.name !== existing.name,
        },
        organizationId: context.organizationId,
        requestId: context.requestId,
      },
    });

    return optionResponse(option) as unknown as Prisma.JsonObject;
  }
}
