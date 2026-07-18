/**
 * Core GS1 utilities for pharma serialization
 * Handles GTIN validation, check digit calculation, and barcode content building
 */

export interface ValidationResult {
  gtin14: string;
  checkDigitValid: boolean;
  corrected: string;
}

export interface UnitCodeOptions {
  mode: 'gs1' | 'plain';
  lot?: string;
  expiryYYMMDD?: string;
}

export interface UnitCodeResult {
  bcid: 'gs1datamatrix' | 'datamatrix';
  text: string;
}

export interface LogisticsCodeOptions {
  ssccify?: boolean;
}

export interface LogisticsCodeResult {
  bcid: 'gs1-128' | 'code128';
  text: string;
  sscc18?: string;
}

export interface ParsedUnit {
  gtin: string;
  serial: string;
  lot: string;
  expiryYYMMDD: string;
  parentSerial?: string;
  palletSerial?: string;
}

export interface RowError {
  error: string;
  row: any;
}

/**
 * Calculate GS1 mod-10 check digit
 * Weight 3 on rightmost data digit, weight 1 on next, alternating
 */
export function gs1CheckDigit(digitsWithoutCheck: string): number {
  const digits = digitsWithoutCheck.split('').reverse();
  let sum = 0;

  for (let i = 0; i < digits.length; i++) {
    const weight = (i % 2 === 0) ? 3 : 1;
    sum += parseInt(digits[i], 10) * weight;
  }

  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Validate and pad GTIN to 14 digits
 * Returns check digit validity and corrected version
 */
export function validateGtin(gtin: string): ValidationResult {
  // Remove any non-digits
  const cleaned = gtin.replace(/\D/g, '');

  // Validate length (8, 12, 13, or 14 digits)
  if (![8, 12, 13, 14].includes(cleaned.length)) {
    throw new Error(`Invalid GTIN length: ${cleaned.length}. Must be 8, 12, 13, or 14 digits.`);
  }

  // Pad to 14 digits with leading zeros
  const gtin14 = cleaned.padStart(14, '0');

  // Extract check digit (last digit)
  const providedCheckDigit = parseInt(gtin14[13], 10);

  // Calculate correct check digit
  const calculatedCheckDigit = gs1CheckDigit(gtin14.substring(0, 13));

  // Build corrected GTIN
  const corrected = gtin14.substring(0, 13) + calculatedCheckDigit;

  return {
    gtin14,
    checkDigitValid: providedCheckDigit === calculatedCheckDigit,
    corrected,
  };
}

/**
 * Build unit code (Data Matrix) content
 * GS1 mode: (01)GTIN(17)EXPIRY(10)LOT(21)SERIAL
 * Plain mode: 01GTIN21SERIAL (no lot/expiry)
 */
export function buildUnitCode(
  gtin14: string,
  serial: string,
  options: UnitCodeOptions
): UnitCodeResult {
  const { mode, lot, expiryYYMMDD } = options;

  if (mode === 'gs1') {
    // GS1 mode: AI format with parentheses
    // Order: (01) → (17) → (10) → (21) last (variable-length)
    let text = `(01)${gtin14}`;

    if (expiryYYMMDD) {
      text += `(17)${expiryYYMMDD}`;
    }

    if (lot) {
      text += `(10)${lot}`;
    }

    text += `(21)${serial}`;

    return {
      bcid: 'gs1datamatrix',
      text,
    };
  } else {
    // Plain mode: just concatenate without parentheses or lot/expiry
    const text = `01${gtin14}21${serial}`;

    return {
      bcid: 'datamatrix',
      text,
    };
  }
}

/**
 * Build logistics code (case/pallet barcode)
 * Default: Code 128 with raw 17 digits
 * SSCC-ified: GS1-128 with (00) and 18-digit SSCC
 */
export function buildLogisticsCode(
  serial17: string,
  options: LogisticsCodeOptions = {}
): LogisticsCodeResult {
  const { ssccify = false } = options;

  if (ssccify) {
    // Calculate 18th check digit
    const checkDigit = gs1CheckDigit(serial17);
    const sscc18 = serial17 + checkDigit;

    return {
      bcid: 'gs1-128',
      text: `(00)${sscc18}`,
      sscc18,
    };
  } else {
    // Plain Code 128
    return {
      bcid: 'code128',
      text: serial17,
    };
  }
}

/**
 * Generate app key (GTIN + serial concatenated, no AI prefixes)
 * This is what the mobile app uses to identify scanned units
 */
export function appKey(gtin14: string, serial: string): string {
  return `${gtin14}${serial}`;
}

/**
 * Convert various expiry date formats to YYMMDD
 * Accepts: YYYY-MM-DD, YYMMDD, DD/MM/YYYY, etc.
 */
export function expiryToYYMMDD(input: string): string {
  // Already in YYMMDD format (6 digits)
  if (/^\d{6}$/.test(input)) {
    return input;
  }

  // YYYY-MM-DD format
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (iso) {
    const yy = iso[1].substring(2);
    return `${yy}${iso[2]}${iso[3]}`;
  }

  // DD/MM/YYYY format
  const uk = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input);
  if (uk) {
    const yy = uk[3].substring(2);
    return `${yy}${uk[2]}${uk[1]}`;
  }

  // Try parsing as Date object
  const date = new Date(input);
  if (!isNaN(date.getTime())) {
    const yy = date.getFullYear().toString().substring(2);
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    return `${yy}${mm}${dd}`;
  }

  throw new Error(`Unable to parse expiry date: ${input}`);
}

/**
 * Parse a hierarchy CSV row
 * Handles both element-string and app-key SerialNumber formats
 */
export function parseHierarchyRow(row: {
  SerialNumber: string;
  ParentSerialNumber?: string;
  PalletSerialNumber?: string;
  CountryDrugCode: string;
  LotNumber: string;
  ExpirationDate: string;
}): ParsedUnit | RowError {
  try {
    const { SerialNumber, ParentSerialNumber, PalletSerialNumber, CountryDrugCode, LotNumber, ExpirationDate } = row;

    let gtin: string;
    let serial: string;

    // Auto-detect format
    // Format 1: Element-string form: 01 + GTIN (13 or 14 digits) + 21 + serial
    // Try both 14-digit and 13-digit GTIN formats
    if (SerialNumber.startsWith('01') && SerialNumber.length >= 18) {
      // Try 14-digit GTIN first: positions 16-17 should be "21"
      if (SerialNumber.substring(16, 18) === '21') {
        gtin = SerialNumber.substring(2, 16);
        serial = SerialNumber.substring(18);
      }
      // Try 13-digit GTIN: positions 15-16 should be "21"
      else if (SerialNumber.substring(15, 17) === '21') {
        gtin = '0' + SerialNumber.substring(2, 15); // Pad to 14 digits
        serial = SerialNumber.substring(17);
      } else {
        return {
          error: `Unable to find AI 21 in SerialNumber: ${SerialNumber}`,
          row,
        };
      }
    }
    // Format 2: App-key form: GTIN + serial (no prefixes)
    // CountryDrugCode can be 13 or 14 digits
    else if (SerialNumber.startsWith(CountryDrugCode)) {
      const gtinLength = CountryDrugCode.length;
      gtin = SerialNumber.substring(0, gtinLength);
      // Pad to 14 digits if needed
      if (gtin.length === 13) {
        gtin = '0' + gtin;
      }
      serial = SerialNumber.substring(gtinLength);
    } else {
      return {
        error: `Unable to parse SerialNumber format: ${SerialNumber}`,
        row,
      };
    }

    // Convert expiry date
    const expiryYYMMDD = expiryToYYMMDD(ExpirationDate);

    return {
      gtin,
      serial,
      lot: LotNumber,
      expiryYYMMDD,
      parentSerial: ParentSerialNumber,
      palletSerial: PalletSerialNumber,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown parsing error',
      row,
    };
  }
}
