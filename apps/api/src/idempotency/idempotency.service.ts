import { createHash } from "node:crypto";

import { ConflictException, Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@sistema-erp/database";

import { DatabaseService } from "../database/database.service.js";
import { RequestContextService } from "../request-context/request-context.service.js";

const IDEMPOTENCY_TTL_MILLISECONDS = 24 * 60 * 60 * 1_000;
const KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export type IdempotentResult<T> = { data: T; replayed: boolean };

function hashRequest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

@Injectable()
export class IdempotencyService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService,
  ) {}

  async execute<T extends Prisma.JsonObject>(options: {
    key: string;
    operation: string;
    request: Prisma.JsonObject;
    responseStatus?: number;
    run: (transaction: Prisma.TransactionClient) => Promise<T>;
  }): Promise<IdempotentResult<T>> {
    if (!KEY_PATTERN.test(options.key)) {
      throw new ConflictException("Invalid idempotency key");
    }

    const context = this.requestContext.getAuthenticated();
    const requestHash = hashRequest(options.request);

    return this.database.value.$transaction(async (transaction) => {
      const uniqueKey = {
        organizationId: context.organizationId,
        operation: options.operation,
        key: options.key,
      };
      const existing = await transaction.idempotencyRecord.findUnique({
        where: { organizationId_operation_key: uniqueKey },
      });

      if (existing && existing.expiresAt > new Date()) {
        if (existing.requestHash !== requestHash || !existing.responseBody) {
          throw new ConflictException("Idempotency key is already in use");
        }

        return { data: existing.responseBody as T, replayed: true };
      }

      if (existing) {
        await transaction.idempotencyRecord.delete({ where: { id: existing.id } });
      }

      const record = await transaction.idempotencyRecord.create({
        data: {
          expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MILLISECONDS),
          key: options.key,
          operation: options.operation,
          organizationId: context.organizationId,
          requestHash,
        },
      });
      const data = await options.run(transaction);

      await transaction.idempotencyRecord.update({
        data: { responseBody: data, responseStatus: options.responseStatus ?? 201 },
        where: { id: record.id },
      });

      return { data, replayed: false };
    });
  }
}
