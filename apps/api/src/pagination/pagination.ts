import { BadRequestException } from "@nestjs/common";

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;
export const MAX_SEARCH_LENGTH = 120;

export type PageRequest = {
  limit: number;
  offset: number;
};

function parseInteger(value: unknown, fallback: number): number {
  if (value === undefined || value === "") {
    return fallback;
  }

  if (typeof value !== "string" || !/^\d{1,9}$/.test(value)) {
    throw new BadRequestException();
  }

  return Number.parseInt(value, 10);
}

export function parsePageRequest(query: { limit?: unknown; offset?: unknown }): PageRequest {
  const limit = parseInteger(query.limit, DEFAULT_PAGE_LIMIT);
  const offset = parseInteger(query.offset, 0);

  if (limit < 1 || limit > MAX_PAGE_LIMIT) {
    throw new BadRequestException();
  }

  return { limit, offset };
}

export function parseSearch(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.length > MAX_SEARCH_LENGTH) {
    throw new BadRequestException();
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  if (value !== "true" && value !== "false") {
    throw new BadRequestException();
  }

  return value === "true";
}

export function parseEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new BadRequestException();
  }

  return value as T;
}
