import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { MembershipRole } from "@sistema-erp/database";

import { Roles } from "../authorization/roles.decorator.js";
import { ApiErrorResponseDto } from "../errors/api-error.dto.js";
import {
  CreateNfeIngestionResponseDto,
  NfeIntakePreviewDto,
  NfePersistentIntakeDto,
} from "./fiscal-intake.dto.js";
import { FiscalIntakeService } from "./fiscal-intake.service.js";
import { NfeXmlParseError } from "./nfe-xml.parser.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function xmlBody(body: unknown): string | Uint8Array {
  if (typeof body === "string" && body.length > 0) return body;
  if (body instanceof Uint8Array && body.byteLength > 0) return body;
  throw new BadRequestException();
}

function xmlContentType(value: string | undefined): "application/xml" | "text/xml" {
  const contentType = value?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType === "application/xml" || contentType === "text/xml") return contentType;
  throw new BadRequestException();
}

@ApiBearerAuth()
@ApiTags("fiscal-intake")
@Controller("fiscal-intake/nfe")
@ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
export class FiscalIntakeController {
  constructor(@Inject(FiscalIntakeService) private readonly fiscalIntake: FiscalIntakeService) {}

  @Post("previews")
  @HttpCode(HttpStatus.OK)
  @ApiConsumes("application/xml", "text/xml")
  @ApiBody({
    description: "Conteúdo original de uma NF-e 4.00, com limite de 5 MiB",
    schema: { type: "string" },
  })
  @ApiOkResponse({ type: NfeIntakePreviewDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiResponse({ status: 413, type: ApiErrorResponseDto })
  @ApiResponse({ status: 415, type: ApiErrorResponseDto })
  async preview(@Body() body: unknown): Promise<NfeIntakePreviewDto> {
    try {
      return await this.fiscalIntake.preview(xmlBody(body));
    } catch (error) {
      if (error instanceof NfeXmlParseError) throw new BadRequestException();
      throw error;
    }
  }

  @Post("ingestions")
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiConsumes("application/xml", "text/xml")
  @ApiBody({
    description: "Bytes originais de uma NF-e 4.00, com limite de 5 MiB",
    schema: { format: "binary", type: "string" },
  })
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @ApiCreatedResponse({ type: CreateNfeIngestionResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async ingest(
    @Body() body: unknown,
    @Headers("content-type") contentType: string | undefined,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<CreateNfeIngestionResponseDto> {
    if (!idempotencyKey) throw new BadRequestException();
    try {
      return await this.fiscalIntake.ingest(
        xmlBody(body),
        xmlContentType(contentType),
        idempotencyKey,
      );
    } catch (error) {
      if (error instanceof NfeXmlParseError) throw new BadRequestException();
      throw error;
    }
  }

  @Post("documents/:documentId/resolve")
  @HttpCode(HttpStatus.OK)
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiParam({ format: "uuid", name: "documentId", type: String })
  @ApiOkResponse({ type: NfePersistentIntakeDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  resolve(@Param("documentId") documentId: string): Promise<NfePersistentIntakeDto> {
    if (!UUID_PATTERN.test(documentId)) throw new BadRequestException();
    return this.fiscalIntake.resolve(documentId);
  }
}
