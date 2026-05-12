import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { assertInstitutionUploadScope } from './institution-scope.util';

describe('assertInstitutionUploadScope', () => {
  it('allows super-admin requests without matching institution on request', () => {
    expect(() =>
      assertInstitutionUploadScope('inst-1', {
        institutionsId: undefined,
        isSuperAdminRequest: true,
      }),
    ).not.toThrow();
  });

  it('rejects missing institutionsId in URL', () => {
    expect(() => assertInstitutionUploadScope('', {})).toThrow(BadRequestException);
  });

  it('rejects institution admin without request institution context', () => {
    expect(() =>
      assertInstitutionUploadScope('inst-1', {
        isSuperAdminRequest: false,
      }),
    ).toThrow(ForbiddenException);
  });

  it('rejects institution mismatch', () => {
    expect(() =>
      assertInstitutionUploadScope('inst-1', {
        institutionsId: 'inst-2',
        isSuperAdminRequest: false,
      }),
    ).toThrow(ForbiddenException);
  });

  it('allows matching institution', () => {
    expect(() =>
      assertInstitutionUploadScope('inst-1', {
        institutionsId: 'inst-1',
        isSuperAdminRequest: false,
      }),
    ).not.toThrow();
  });
});
