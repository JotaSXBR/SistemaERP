import { HttpException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { LoginRateLimiterService } from "../src/identity/login-rate-limiter.service.js";

describe("login rate limiter", () => {
  it("blocks after five failures inside the window", () => {
    const limiter = new LoginRateLimiterService();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      limiter.recordFailure("tenant:user", 1_000);
    }

    expect(() => limiter.assertAllowed("tenant:user", 2_000)).toThrow(HttpException);
  });

  it("allows a new window and resets after success", () => {
    const limiter = new LoginRateLimiterService();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      limiter.recordFailure("tenant:user", 1_000);
    }

    expect(() => limiter.assertAllowed("tenant:user", 901_001)).not.toThrow();
    limiter.recordFailure("tenant:user", 901_001);
    limiter.reset("tenant:user");
    expect(() => limiter.assertAllowed("tenant:user", 901_002)).not.toThrow();
  });
});
