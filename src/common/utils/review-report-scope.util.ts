import { ForbiddenException } from '@nestjs/common';

export type ReviewReportScopeContext = {
  isSuperAdminRequest?: boolean;
  institutionsId?: string;
};

/**
 * Institution admins may only access reports whose reported user belongs to their institution.
 * Super-admin requests (central admin origin) bypass this check.
 */
export function assertReviewReportScope(
  reportedUserInstitutionsId: string | null | undefined,
  ctx: ReviewReportScopeContext,
): void {
  if (ctx.isSuperAdminRequest) {
    return;
  }

  if (!ctx.institutionsId) {
    throw new ForbiddenException('Institution context is missing for this request.');
  }

  if (!reportedUserInstitutionsId) {
    throw new ForbiddenException('This report is not scoped to any institution.');
  }

  if (
    String(reportedUserInstitutionsId).trim() !== String(ctx.institutionsId).trim()
  ) {
    throw new ForbiddenException('You do not have access to this report.');
  }
}
