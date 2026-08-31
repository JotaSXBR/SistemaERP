import type { MembershipRole } from "@sistema-erp/database";

export type RequestContext = {
  correlationId: string;
  membershipId?: string;
  organizationId?: string;
  requestId: string;
  role?: MembershipRole;
  userId?: string;
};
