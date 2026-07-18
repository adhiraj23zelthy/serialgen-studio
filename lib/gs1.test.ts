import { describe, it, expect } from 'vitest';
import {
  gs1CheckDigit,
  validateGtin,
  buildUnitCode,
  buildLogisticsCode,
  appKey,
  parseHierarchyRow,
  expiryToYYMMDD,
} from './gs1';

describe('gs1CheckDigit', () => {
  it('calculates check digit correctly for test GTIN', () => {
    expect(gs1CheckDigit('1234560000123')).toBe(7);
  });

  it('calculates check digit for zeros', () => {
    expect(gs1CheckDigit('0000000000000')).toBe(0);
  });

  it('handles different GTIN lengths', () => {
    expect(gs1CheckDigit('123456789012')).toBe(8); // GTIN-13
  });
});

describe('validateGtin', () => {
  it('validates GTIN with invalid check digit', () => {
    const result = validateGtin('12345600001234');
    expect(result.checkDigitValid).toBe(false);
    expect(result.corrected).toBe('12345600001237');
    expect(result.gtin14).toBe('12345600001234');
  });

  it('validates GTIN with valid check digit', () => {
    const result = validateGtin('12345600001237');
    expect(result.checkDigitValid).toBe(true);
    expect(result.corrected).toBe('12345600001237');
    expect(result.gtin14).toBe('12345600001237');
  });

  it('pads 8-digit GTIN to 14 digits', () => {
    const result = validateGtin('12345678');
    expect(result.gtin14).toBe('00000012345678');
    expect(result.gtin14.length).toBe(14);
  });

  it('handles 8-digit GTIN', () => {
    const result = validateGtin('12345670');
    expect(result.gtin14).toBe('00000012345670');
  });

  it('throws error for invalid length', () => {
    expect(() => validateGtin('12345')).toThrow('Invalid GTIN length');
  });
});

describe('buildUnitCode', () => {
  it('builds GS1 DataMatrix with all fields', () => {
    const result = buildUnitCode('12345600001234', '3000000000000013', {
      mode: 'gs1',
      lot: 'LOT002',
      expiryYYMMDD: '290630',
    });

    expect(result.bcid).toBe('gs1datamatrix');
    expect(result.text).toBe('(01)12345600001234(17)290630(10)LOT002(21)3000000000000013');
  });

  it('builds GS1 DataMatrix with only GTIN and serial', () => {
    const result = buildUnitCode('12345600001234', '3000000000000013', {
      mode: 'gs1',
    });

    expect(result.bcid).toBe('gs1datamatrix');
    expect(result.text).toBe('(01)12345600001234(21)3000000000000013');
  });

  it('builds GS1 DataMatrix with expiry but no lot', () => {
    const result = buildUnitCode('12345600001234', '3000000000000013', {
      mode: 'gs1',
      expiryYYMMDD: '290630',
    });

    expect(result.bcid).toBe('gs1datamatrix');
    expect(result.text).toBe('(01)12345600001234(17)290630(21)3000000000000013');
  });

  it('builds plain DataMatrix (no lot/expiry)', () => {
    const result = buildUnitCode('12345600001234', '3000000000000013', {
      mode: 'plain',
    });

    expect(result.bcid).toBe('datamatrix');
    expect(result.text).toBe('0112345600001234213000000000000013');
  });

  it('builds plain DataMatrix ignoring lot/expiry', () => {
    const result = buildUnitCode('12345600001234', '3000000000000013', {
      mode: 'plain',
      lot: 'LOT002',
      expiryYYMMDD: '290630',
    });

    expect(result.bcid).toBe('datamatrix');
    expect(result.text).toBe('0112345600001234213000000000000013');
  });
});

describe('buildLogisticsCode', () => {
  it('builds Code 128 with 17-digit serial', () => {
    const result = buildLogisticsCode('53911890305807601', { ssccify: false });

    expect(result.bcid).toBe('code128');
    expect(result.text).toBe('53911890305807601');
    expect(result.sscc18).toBeUndefined();
  });

  it('builds GS1-128 with SSCC check digit', () => {
    const result = buildLogisticsCode('53911890305807601', { ssccify: true });

    expect(result.bcid).toBe('gs1-128');
    expect(result.sscc18).toBeDefined();
    expect(result.sscc18?.length).toBe(18);
    expect(result.text).toBe(`(00)${result.sscc18}`);
  });

  it('defaults to non-SSCC mode', () => {
    const result = buildLogisticsCode('89012345678901250');

    expect(result.bcid).toBe('code128');
    expect(result.text).toBe('89012345678901250');
  });
});

describe('appKey', () => {
  it('concatenates GTIN and serial', () => {
    expect(appKey('12345600001234', '3000000000000013')).toBe('123456000012343000000000000013');
  });

  it('handles different serial formats', () => {
    expect(appKey('12345600001234', '0201234567890123')).toBe('123456000012340201234567890123');
  });
});

describe('expiryToYYMMDD', () => {
  it('converts YYYY-MM-DD to YYMMDD', () => {
    expect(expiryToYYMMDD('2029-06-30')).toBe('290630');
  });

  it('passes through YYMMDD format', () => {
    expect(expiryToYYMMDD('290630')).toBe('290630');
  });

  it('converts DD/MM/YYYY to YYMMDD', () => {
    expect(expiryToYYMMDD('30/06/2029')).toBe('290630');
  });

  it('handles different years', () => {
    expect(expiryToYYMMDD('2025-12-31')).toBe('251231');
  });

  it('throws error for invalid format', () => {
    expect(() => expiryToYYMMDD('invalid')).toThrow('Unable to parse expiry date');
  });
});

describe('parseHierarchyRow', () => {
  const baseRow = {
    CountryDrugCode: '12345600001234',
    LotNumber: 'LOT002',
    ExpirationDate: '2029-06-30',
    ParentSerialNumber: '53911890305807601',
    PalletSerialNumber: '89012345678901250',
  };

  it('parses element-string format', () => {
    const row = {
      ...baseRow,
      SerialNumber: '0112345600001234210201234567890123',
    };

    const result = parseHierarchyRow(row);

    if ('error' in result) {
      throw new Error(result.error);
    }

    expect(result.gtin).toBe('12345600001234');
    expect(result.serial).toBe('0201234567890123');
    expect(result.lot).toBe('LOT002');
    expect(result.expiryYYMMDD).toBe('290630');
    expect(result.parentSerial).toBe('53911890305807601');
    expect(result.palletSerial).toBe('89012345678901250');
  });

  it('parses app-key format', () => {
    const row = {
      ...baseRow,
      SerialNumber: '123456000012340201234567890123',
    };

    const result = parseHierarchyRow(row);

    if ('error' in result) {
      throw new Error(result.error);
    }

    expect(result.gtin).toBe('12345600001234');
    expect(result.serial).toBe('0201234567890123');
    expect(result.lot).toBe('LOT002');
    expect(result.expiryYYMMDD).toBe('290630');
  });

  it('returns error for invalid SerialNumber format', () => {
    const row = {
      ...baseRow,
      SerialNumber: 'INVALID',
    };

    const result = parseHierarchyRow(row);

    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('row');
  });

  it('parses actual CSV row from test file', () => {
    const row = {
      SerialNumber: '0112345600001234210201234567890123',
      ParentSerialNumber: '53911890305807601',
      PalletSerialNumber: '89012345678901250',
      CountryDrugCode: '12345600001234',
      LotNumber: 'LOT002',
      ExpirationDate: '2029-06-30',
    };

    const result = parseHierarchyRow(row);

    if ('error' in result) {
      throw new Error(result.error);
    }

    expect(result.gtin).toBe('12345600001234');
    expect(result.serial).toBe('0201234567890123');
    expect(result.expiryYYMMDD).toBe('290630');
  });
});
