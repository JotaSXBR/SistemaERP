import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

const ATTEMPT_WINDOW_MILLISECONDS = 15 * 60 * 1_000;
const MAX_ATTEMPTS = 5;

type Attempt = { count: number; windowEndsAt: number };

@Injectable()
export class LoginRateLimiterService {
  private readonly attempts = new Map<string, Attempt>();

  assertAllowed(key: string, now = Date.now()): void {
    const attempt = this.attempts.get(key);

    if (attempt && attempt.windowEndsAt > now && attempt.count >= MAX_ATTEMPTS) {
      throw new HttpException("Too many authentication attempts", HttpStatus.TOO_MANY_REQUESTS);
    }

    if (attempt && attempt.windowEndsAt <= now) {
      this.attempts.delete(key);
    }
  }

  recordFailure(key: string, now = Date.now()): void {
    const attempt = this.attempts.get(key);

    if (!attempt || attempt.windowEndsAt <= now) {
      this.attempts.set(key, { count: 1, windowEndsAt: now + ATTEMPT_WINDOW_MILLISECONDS });
      return;
    }

    attempt.count += 1;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}
