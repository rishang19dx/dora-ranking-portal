import { describe, expect, it } from 'vitest';
import {
  dataOwningUnitIds,
  getAncestorIds,
  getDescendantIds,
  getUnit,
  isValidUnitId,
  ORGANOGRAM,
  scopesForUnits,
  searchUnitIds,
  unitBreadcrumb,
  unitLabel,
} from './organogram';

describe('getUnit / isValidUnitId', () => {
  it('finds the root unit by id', () => {
    expect(getUnit('iit-mandi')).toBe(ORGANOGRAM);
  });

  it('finds a deeply nested unit by id', () => {
    const unit = getUnit('shss-faculty-body');
    expect(unit).toBeDefined();
    expect(unit?.name).toBe('School Faculty Body');
  });

  it('returns undefined for an unknown id', () => {
    expect(getUnit('does-not-exist')).toBeUndefined();
  });

  it('reports validity consistently with getUnit', () => {
    expect(isValidUnitId('director')).toBe(true);
    expect(isValidUnitId('does-not-exist')).toBe(false);
  });
});

describe('unitLabel', () => {
  it('prefers the short name when present', () => {
    expect(unitLabel('shss')).toBe('SHSS');
  });

  it('falls back to the full name when there is no short name', () => {
    expect(unitLabel('audit')).toBe('Audit');
  });

  it('falls back to the raw id for an unknown unit', () => {
    expect(unitLabel('nope')).toBe('nope');
  });
});

describe('unitBreadcrumb', () => {
  it('lists ancestor labels excluding the root and the unit itself', () => {
    const breadcrumb = unitBreadcrumb('shss-faculty-body');
    // unitLabel prefers each unit's shortName ('Academics') over its full name.
    expect(breadcrumb).toEqual(['Director', 'Academics', 'SHSS']);
  });

  it('returns an empty array for an unknown unit', () => {
    expect(unitBreadcrumb('nope')).toEqual([]);
  });
});

describe('getDescendantIds', () => {
  it('collects every descendant id, excluding the unit itself by default', () => {
    const descendants = getDescendantIds('shss');
    expect(descendants).toContain('shss-faculty-body');
    expect(descendants).not.toContain('shss');
  });

  it('includes the unit itself when requested', () => {
    const descendants = getDescendantIds('shss', true);
    expect(descendants).toContain('shss');
  });

  it('returns an empty array for a leaf or unknown unit', () => {
    expect(getDescendantIds('shss-faculty-body')).toEqual([]);
    expect(getDescendantIds('nope')).toEqual([]);
  });
});

describe('getAncestorIds', () => {
  it('lists ids from the root down to the parent, excluding the unit itself', () => {
    const ancestors = getAncestorIds('shss-faculty-body');
    expect(ancestors).toEqual(['iit-mandi', 'director', 'dean-academics', 'shss']);
  });

  it('returns an empty array for an unknown unit', () => {
    expect(getAncestorIds('nope')).toEqual([]);
  });
});

describe('searchUnitIds', () => {
  it('matches case-insensitively across name, short name, head, email and description', () => {
    expect(searchUnitIds('registrar')).toContain('registrar');
  });

  it('returns an empty array for an empty or whitespace-only query', () => {
    expect(searchUnitIds('')).toEqual([]);
    expect(searchUnitIds('   ')).toEqual([]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(searchUnitIds('zzz-no-such-office-zzz')).toEqual([]);
  });
});

describe('scopesForUnits', () => {
  it('deduplicates scopes owned by multiple requested units', () => {
    const scopes = scopesForUnits(['shss', 'sbs']);
    const occurrences = scopes.filter((s) => s === 'faculty-roster').length;
    expect(occurrences).toBe(1);
  });

  it('returns an empty array for units with no data scopes', () => {
    expect(scopesForUnits(['iit-mandi'])).toEqual([]);
  });

  it('ignores unknown unit ids without throwing', () => {
    expect(() => scopesForUnits(['nope'])).not.toThrow();
    expect(scopesForUnits(['nope'])).toEqual([]);
  });
});

describe('dataOwningUnitIds', () => {
  it('only returns units that own at least one data scope', () => {
    const ids = dataOwningUnitIds();
    expect(ids).toContain('shss');
    expect(ids).not.toContain('iit-mandi');
    ids.forEach((id) => {
      expect(getUnit(id)!.dataScopes.length).toBeGreaterThan(0);
    });
  });
});
