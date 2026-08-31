import { AsyncLocalStorage } from "node:async_hooks";

import { Injectable } from "@nestjs/common";

import type { RequestContext } from "./request-context.js";

export type AuthenticatedRequestContext = RequestContext & {
  membershipId: string;
  organizationId: string;
  role: NonNullable<RequestContext["role"]>;
  userId: string;
};

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  get(): RequestContext | undefined {
    return this.storage.getStore();
  }

  getAuthenticated(): AuthenticatedRequestContext {
    const context = this.get();

    if (!context?.membershipId || !context.organizationId || !context.role || !context.userId) {
      throw new Error("Authenticated request context is unavailable");
    }

    return context as AuthenticatedRequestContext;
  }

  run<T>(context: RequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  setIdentity(identity: Omit<AuthenticatedRequestContext, "correlationId" | "requestId">): void {
    const context = this.get();

    if (!context) {
      throw new Error("Request context is unavailable");
    }

    Object.assign(context, identity);
  }
}
