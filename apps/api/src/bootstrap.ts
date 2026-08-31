import { ConsoleLogger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module.js";
import { ApiExceptionFilter } from "./errors/api-exception.filter.js";
import { RequestContextService } from "./request-context/request-context.service.js";

export type CreateApplicationOptions = { logger?: false | ConsoleLogger };

export async function createApplication(
  options: CreateApplicationOptions = {},
): Promise<NestFastifyApplication> {
  const logger = options.logger ?? new ConsoleLogger({ json: true });
  const application = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { logger },
  );

  application.setGlobalPrefix("api/v1");
  application.useGlobalFilters(new ApiExceptionFilter(application.get(RequestContextService)));

  const openApiConfiguration = new DocumentBuilder()
    .setTitle("Sistema ERP API")
    .setDescription("Contrato HTTP público do Sistema ERP")
    .setVersion("1.0.0")
    .build();
  const documentFactory = () => SwaggerModule.createDocument(application, openApiConfiguration);

  SwaggerModule.setup("docs", application, documentFactory, {
    jsonDocumentUrl: "openapi.json",
  });

  return application;
}
