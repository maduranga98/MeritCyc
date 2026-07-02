import { describe, it, expect } from 'vitest';
import { getNavItems, type NavItem } from './navConfig';
import type { RoleCode } from '../../types/roles';

const flatten = (items: NavItem[]): NavItem[] =>
  items.flatMap((i) => [i, ...(i.subItems ? flatten(i.subItems) : [])]);

describe('getNavItems', () => {
  it('returns no items when role is missing or unknown', () => {
    expect(getNavItems(undefined)).toEqual([]);
    expect(getNavItems('platform_admin' as RoleCode)).toEqual([]);
  });

  it.each(['super_admin', 'hr_admin', 'manager', 'employee'] as RoleCode[])(
    'returns items with hrefs and translation keys for %s',
    (role) => {
      const items = flatten(getNavItems(role));
      expect(items.length).toBeGreaterThan(0);
      items.forEach((item) => {
        expect(item.href).toMatch(/^\//);
        expect(item.nameKey).toMatch(/^nav\./);
      });
    }
  );

  it('scopes admin-only pages away from employees and managers', () => {
    const employeeHrefs = flatten(getNavItems('employee')).map((i) => i.href);
    const managerHrefs = flatten(getNavItems('manager')).map((i) => i.href);
    for (const hrefs of [employeeHrefs, managerHrefs]) {
      expect(hrefs).not.toContain('/people/directory');
      expect(hrefs).not.toContain('/audit-trail');
      expect(hrefs).not.toContain('/settings/general');
    }
  });

  it('gives admins access to people and analytics sections', () => {
    const adminHrefs = flatten(getNavItems('super_admin')).map((i) => i.href);
    expect(adminHrefs).toContain('/people/directory');
    expect(adminHrefs).toContain('/audit-trail');
    expect(adminHrefs).toContain('/cycles');
  });
});
