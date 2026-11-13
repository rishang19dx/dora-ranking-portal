import { describe, expect, it } from 'vitest';
import {
  custodianUnitIds,
  dataItemLabel,
  getDataItem,
  isValidDataItemId,
  proofFormatsFor,
  suggestedDataItemIds,
  unsupportedDataItemIds,
} from './data-catalogue';

describe('getDataItem / isValidDataItemId / dataItemLabel', () => {
  it('finds a known data item by id', () => {
    const item = getDataItem('student-intake');
    expect(item?.group).toBe('TLR');
  });

  it('reports validity consistently with getDataItem', () => {
    expect(isValidDataItemId('student-intake')).toBe(true);
    expect(isValidDataItemId('nope')).toBe(false);
  });

  it('falls back to the raw id when the label is unknown', () => {
    expect(dataItemLabel('nope')).toBe('nope');
  });
});

describe('custodianUnitIds', () => {
  it('lists every unit whose data scopes include the given item', () => {
    const custodians = custodianUnitIds('faculty-roster');
    expect(custodians).toContain('shss-faculty-body');
    expect(custodians).toContain('faculty-service-matters');
  });

  it('returns an empty array for a data item nobody owns', () => {
    expect(custodianUnitIds('no-such-scope')).toEqual([]);
  });
});

describe('suggestedDataItemIds', () => {
  it('suggests the data items the selected units are custodians of', () => {
    const suggested = suggestedDataItemIds(['shss']);
    expect(suggested).toEqual(
      expect.arrayContaining(['student-intake', 'faculty-roster', 'phd-awarded', 'publications']),
    );
  });

  it('deduplicates suggestions shared across multiple units', () => {
    const suggested = suggestedDataItemIds(['shss', 'sbs']);
    const occurrences = suggested.filter((id) => id === 'faculty-roster').length;
    expect(occurrences).toBe(1);
  });

  it('returns an empty array for units with no data scopes', () => {
    expect(suggestedDataItemIds(['iit-mandi'])).toEqual([]);
  });
});

describe('unsupportedDataItemIds', () => {
  it('flags requested items a unit does not own', () => {
    const unsupported = unsupportedDataItemIds('shss', ['student-intake', 'capital-expenditure']);
    expect(unsupported).toEqual(['capital-expenditure']);
  });

  it('returns an empty array when the unit supports every requested item', () => {
    expect(unsupportedDataItemIds('shss', ['student-intake'])).toEqual([]);
  });

  it('treats an unknown unit as owning nothing', () => {
    expect(unsupportedDataItemIds('nope', ['student-intake'])).toEqual(['student-intake']);
  });
});

describe('proofFormatsFor', () => {
  it('returns the sorted union of accepted proof formats', () => {
    // student-intake accepts ['XLSX', 'CSV', 'PDF']; institute-profile accepts ['PDF', 'DOCX'].
    const formats = proofFormatsFor(['student-intake', 'institute-profile']);
    expect(formats).toEqual(['CSV', 'DOCX', 'PDF', 'XLSX']);
  });

  it('returns an empty array for unknown data items', () => {
    expect(proofFormatsFor(['nope'])).toEqual([]);
  });
});
