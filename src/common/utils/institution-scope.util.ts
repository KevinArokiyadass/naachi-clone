import { BadRequestException, ForbiddenException } from '@nestjs/common';

export type InstitutionScopeRequestContext = {
  institutionsId?: string;
  isSuperAdminRequest?: boolean;
};

/**
 * Shared institution scoping for URL-based uploads (admin + user bulk flows).
 * Keeps one implementation so super-admin vs institution-admin rules cannot drift.
 */
export function assertInstitutionUploadScope(
  institutionsId: string,
  requestContext?: InstitutionScopeRequestContext,
): void {
  if (!institutionsId) {
    throw new BadRequestException('institutionsId is required in URL');
  }

  if (requestContext?.isSuperAdminRequest) {
    return;
  }

  const requestInstitutionId = requestContext?.institutionsId;
  if (!requestInstitutionId) {
    throw new ForbiddenException('Institution context is missing for this request.');
  }

  if (String(requestInstitutionId).trim() !== String(institutionsId).trim()) {
    throw new ForbiddenException('Institution mismatch. You can only upload for your institution.');
  }
}
