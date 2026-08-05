import { describe, expect, it } from 'vitest';
import { isNavItemActive } from './nav-active';

describe('isNavItemActive', () => {
  it('matches an exact pathname', () => {
    expect(isNavItemActive('/students', '/students')).toBe(true);
  });

  it('matches a nested pathname under the href', () => {
    expect(isNavItemActive('/students/abc123', '/students')).toBe(true);
  });

  it('does not match a sibling route', () => {
    expect(isNavItemActive('/documents', '/students')).toBe(false);
  });

  it('does not match a route that merely shares a text prefix without a slash boundary', () => {
    expect(isNavItemActive('/students-archive', '/students')).toBe(false);
  });

  it('does not treat a nested route as matching an unrelated root item', () => {
    expect(isNavItemActive('/students', '/dashboard')).toBe(false);
  });

  it('returns false for a null pathname', () => {
    expect(isNavItemActive(null, '/dashboard')).toBe(false);
  });
});
