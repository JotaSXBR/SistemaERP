import { Global, Module, type MiddlewareConsumer, type NestModule } from "@nestjs/common";

import { RequestContextMiddleware } from "./request-context.middleware.js";
import { RequestContextService } from "./request-context.service.js";

@Global()
@Module({
  exports: [RequestContextService],
  providers: [RequestContextService],
})
export class RequestContextModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("*path");
  }
}
