import { SetMetadata } from "@nestjs/common";
import type { MembershipRole } from "@sistema-erp/database";

export const ROLES_KEY = "authorization:roles";
export const Roles = (...roles: MembershipRole[]) => SetMetadata(ROLES_KEY, roles);
