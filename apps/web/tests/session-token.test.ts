import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearSessionToken,
  readSessionToken,
  subscribeToSessionToken,
  writeSessionToken,
} from "../src/shared/api/session-token.js";

afterEach(() => {
  clearSessionToken();
  vi.restoreAllMocks();
});

describe("session token storage", () => {
  it("keeps the token available for the tab and removes it on clear", () => {
    expect(readSessionToken()).toBeUndefined();

    writeSessionToken("opaque-token");

    expect(readSessionToken()).toBe("opaque-token");
    expect(window.sessionStorage.getItem("sistema-erp.session-token")).toBe("opaque-token");

    clearSessionToken();

    expect(readSessionToken()).toBeUndefined();
    expect(window.sessionStorage.getItem("sistema-erp.session-token")).toBeNull();
  });

  it("notifies subscribers when the token changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToSessionToken(listener);

    writeSessionToken("opaque-token");
    clearSessionToken();
    unsubscribe();
    writeSessionToken("ignored-after-unsubscribe");

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("keeps working when the browser denies access to storage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage is blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage is blocked");
    });

    writeSessionToken("memory-only-token");

    expect(readSessionToken()).toBe("memory-only-token");
  });
});
