import { ForbiddenException } from '@nestjs/common';
import { assertReviewReportScope } from './review-report-scope.util';

describe('assertReviewReportScope', () => {
  it('allows super-admin requests without institution match', () => {
    expect(() =>
      assertReviewReportScope('inst-other', {
        institutionsId: undefined,
        isSuperAdminRequest: true,
      }),
    ).not.toThrow();
  });

  it('rejects institution admin without request institution context', () => {
    expect(() =>
      assertReviewReportScope('inst-1', {
        isSuperAdminRequest: false,
      }),
    ).toThrow(ForbiddenException);
  });

  it('rejects when reported user has no institution', () => {
    expect(() =>
      assertReviewReportScope(undefined, {
        institutionsId: 'inst-1',
        isSuperAdminRequest: false,
      }),
    ).toThrow(ForbiddenException);
  });

  it('rejects institution mismatch', () => {
    expect(() =>
      assertReviewReportScope('inst-1', {
        institutionsId: 'inst-2',
        isSuperAdminRequest: false,
      }),
    ).toThrow(ForbiddenException);
  });

  it('allows matching institution', () => {
    expect(() =>
      assertReviewReportScope('inst-1', {
        institutionsId: 'inst-1',
        isSuperAdminRequest: false,
      }),
    ).not.toThrow();
  });
});
