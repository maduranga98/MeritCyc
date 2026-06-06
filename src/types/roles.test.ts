import { describe, it, expect } from 'vitest';
import { hasMinimumRole, isCompanyScoped, getDashboardPath } from './roles';

// Smoke tests for role-based access control — the backbone of every
// ProtectedRoute decision and the claims-desync (setupRequired) logic.
describe('roles / authorization', () => {
  describe('hasMinimumRole', () => {
    it('grants access when the user role outranks the requirement', () => {
      expect(hasMinimumRole('super_admin', 'manager')).toBe(true);
      expect(hasMinimumRole('hr_admin', 'employee')).toBe(true);
    });

    it('grants access for the exact required role', () => {
      expect(hasMinimumRole('manager', 'manager')).toBe(true);
    });

    it('denies access when the user role is below the requirement', () => {
      expect(hasMinimumRole('employee', 'manager')).toBe(false);
      expect(hasMinimumRole('manager', 'hr_admin')).toBe(false);
    });
  });

  describe('isCompanyScoped', () => {
    it('treats platform_admin as not company-scoped', () => {
      expect(isCompanyScoped('platform_admin')).toBe(false);
    });

    it('treats every other role as company-scoped (companyId required)', () => {
      for (const role of ['super_admin', 'hr_admin', 'manager', 'employee'] as const) {
        expect(isCompanyScoped(role)).toBe(true);
      }
    });
  });

  describe('getDashboardPath', () => {
    it('returns a distinct landing path per role', () => {
      const paths = (['platform_admin', 'super_admin', 'hr_admin', 'manager', 'employee'] as const).map(
        getDashboardPath
      );
      expect(new Set(paths).size).toBe(paths.length);
      paths.forEach((p) => expect(p.startsWith('/')).toBe(true));
    });
  });
});
