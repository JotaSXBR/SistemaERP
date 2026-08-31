import { Catch, HttpException, HttpStatus, Logger, type ExceptionFilter } from "@nestjs/common";
import type { ArgumentsHost } from "@nestjs/common";
import type { FastifyReply } from "fastify";

import { RequestContextService } from "../request-context/request-context.service.js";

type PublicError = {
  code: string;
  details: Record<string, unknown>;
  message: string;
};

const STATUS_ERRORS: Partial<Record<number, Omit<PublicError, "details">>> = {
  [HttpStatus.BAD_REQUEST]: { code: "INVALID_REQUEST", message: "Requisição inválida" },
  [HttpStatus.FORBIDDEN]: { code: "FORBIDDEN", message: "Acesso negado" },
  [HttpStatus.NOT_FOUND]: { code: "RESOURCE_NOT_FOUND", message: "Recurso não encontrado" },
  [HttpStatus.SERVICE_UNAVAILABLE]: {
    code: "SERVICE_UNAVAILABLE",
    message: "Serviço temporariamente indisponível",
  },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    code: "RATE_LIMITED",
    message: "Limite de requisições excedido",
  },
  [HttpStatus.UNAUTHORIZED]: { code: "UNAUTHORIZED", message: "Autenticação necessária" },
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(private readonly requestContext: RequestContextService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const knownError = STATUS_ERRORS[status];
    const publicError: PublicError = knownError
      ? { ...knownError, details: {} }
      : { code: "INTERNAL_ERROR", details: {}, message: "Erro interno do servidor" };
    const context = this.requestContext.get();
    const requestId = context?.requestId ?? "unavailable";

    if (status >= 500) {
      this.logger.error({
        correlationId: context?.correlationId,
        error: exception instanceof Error ? exception.message : String(exception),
        requestId,
        statusCode: status,
      });
    }

    void response.status(status).send({ error: { ...publicError, requestId } });
  }
}
