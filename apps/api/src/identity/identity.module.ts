import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { RolesGuard } from "../authorization/roles.guard.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { AuthenticationGuard } from "./authentication.guard.js";
import { LoginRateLimiterService } from "./login-rate-limiter.service.js";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    LoginRateLimiterService,
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class IdentityModule {}
