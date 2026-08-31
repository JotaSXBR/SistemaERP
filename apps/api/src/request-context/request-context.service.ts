import { AsyncLocalStorage } from "node:async_hooks";

import { Injectable } from "@nestjs/common";

import type { RequestContext } from "./request-context.js";

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  get(): RequestContext | undefined {
    return this.storage.getStore();
  }

  run<T>(context: RequestContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }
}
