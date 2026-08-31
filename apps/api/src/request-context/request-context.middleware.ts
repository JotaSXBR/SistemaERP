import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";

import { Inject, Injectable, Logger, type NestMiddleware } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { RequestContextService } from "./request-context.service.js";

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function createIdentifier(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function readCorrelationId(request: FastifyRequest): string {
  const header = request.headers["x-correlation-id"];
  const value = Array.isArray(header) ? header[0] : header;

  return typeof value === "string" && CORRELATION_ID_PATTERN.test(value)
    ? value
    : createIdentifier("corr");
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestContextMiddleware.name);

  constructor(@Inject(RequestContextService) private readonly context: RequestContextService) {}

  use(request: FastifyRequest, response: ServerResponse, next: () => void): void {
    const requestId = createIdentifier("req");
    const correlationId = readCorrelationId(request);
    const startedAt = performance.now();

    response.setHeader("x-request-id", requestId);
    response.setHeader("x-correlation-id", correlationId);
    response.once("finish", () => {
      this.logger.log({
        correlationId,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        method: request.method,
        requestId,
        route: request.url.split("?", 1)[0],
        statusCode: response.statusCode,
      });
    });

    this.context.run({ correlationId, requestId }, next);
  }
}
