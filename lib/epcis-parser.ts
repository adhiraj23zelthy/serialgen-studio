/**
 * EPCIS XML Parser for GS1 serialization data
 * Parses EPCIS 1.1/1.2 format XML files containing ObjectEvents and AggregationEvents
 */

import { gs1CheckDigit, expiryToYYMMDD, type ParsedUnit, type RowError } from './gs1';

export interface EPCISParseResult {
  units: ParsedUnit[];
  errors: RowError[];
  summary: {
    totalUnits: number;
    totalCases: number;
    totalPallets: number;
    lots: string[];
    gtins: string[];
  };
}

interface SGTINParsed {
  companyPrefix: string;
  itemReference: string;
  serial: string;
  gtin14: string;
}

interface SSCCParsed {
  companyPrefix: string;
  serialReference: string;
  sscc18: string;
}

/**
 * Parse SGTIN URN format: urn:epc:id:sgtin:CompanyPrefix.ItemReference.Serial
 * Example: urn:epc:id:sgtin:0366582.051040.100501557940
 *
 * Returns GTIN-14 constructed from company prefix + item reference + check digit
 */
export function parseSGTIN(urn: string): SGTINParsed | null {
  try {
    // Extract the SGTIN parts after "urn:epc:id:sgtin:"
    const sgtinPart = urn.replace('urn:epc:id:sgtin:', '');
    const parts = sgtinPart.split('.');

    if (parts.length !== 3) {
      console.error('Invalid SGTIN format:', urn);
      return null;
    }

    const [companyPrefix, itemReference, serial] = parts;

    // Construct GTIN-13 from company prefix + item reference
    // Standard format: indicator (0) + company prefix + item reference
    const gtin13Base = '0' + companyPrefix + itemReference;

    // Pad to 13 digits if needed
    const gtin13Padded = gtin13Base.padStart(13, '0');

    // Calculate check digit for GTIN-14
    const checkDigit = gs1CheckDigit(gtin13Padded);
    const gtin14 = gtin13Padded + checkDigit;

    return {
      companyPrefix,
      itemReference,
      serial,
      gtin14,
    };
  } catch (error) {
    console.error('Error parsing SGTIN:', error);
    return null;
  }
}

/**
 * Parse SSCC URN format: urn:epc:id:sscc:CompanyPrefix.SerialReference
 * Example: urn:epc:id:sscc:0366582.0096442038
 *
 * Returns SSCC-18 with extension digit (0) + company prefix + serial reference + check digit
 */
export function parseSSCC(urn: string): SSCCParsed | null {
  try {
    // Extract the SSCC parts after "urn:epc:id:sscc:"
    const ssccPart = urn.replace('urn:epc:id:sscc:', '');
    const parts = ssccPart.split('.');

    if (parts.length !== 2) {
      console.error('Invalid SSCC format:', urn);
      return null;
    }

    const [companyPrefix, serialReference] = parts;

    // Construct SSCC-17 (extension digit 0 + company prefix + serial reference)
    const sscc17 = '0' + companyPrefix + serialReference;

    // Pad to 17 digits
    const sscc17Padded = sscc17.padStart(17, '0');

    // Calculate check digit
    const checkDigit = gs1CheckDigit(sscc17Padded);
    const sscc18 = sscc17Padded + checkDigit;

    return {
      companyPrefix,
      serialReference,
      sscc18,
    };
  } catch (error) {
    console.error('Error parsing SSCC:', error);
    return null;
  }
}

/**
 * Parse EPCIS XML and extract all serialization data
 */
export function parseEPCISXML(xmlContent: string): EPCISParseResult {
  const units: ParsedUnit[] = [];
  const errors: RowError[] = [];
  const casesSet = new Set<string>();
  const palletsSet = new Set<string>();
  const lotsSet = new Set<string>();
  const gtinsSet = new Set<string>();

  try {
    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      errors.push({
        error: 'XML parsing failed: ' + parseError.textContent,
        row: {},
      });
      return {
        units: [],
        errors,
        summary: {
          totalUnits: 0,
          totalCases: 0,
          totalPallets: 0,
          lots: [],
          gtins: [],
        },
      };
    }

    // Extract lot and expiry from ObjectEvents
    const lotExpiryMap = new Map<string, { lot: string; expiry: string }>();

    const objectEvents = xmlDoc.querySelectorAll('ObjectEvent');
    objectEvents.forEach((event) => {
      const lotNode = event.querySelector('LOTNO');
      const expiryNode = event.querySelector('DATEX');

      if (lotNode && expiryNode) {
        const lot = lotNode.textContent || '';
        const expiryDate = expiryNode.textContent || '';

        try {
          const expiryYYMMDD = expiryToYYMMDD(expiryDate);
          lotsSet.add(lot);

          // Get all EPCs in this event
          const epcs = event.querySelectorAll('epcList > epc');
          epcs.forEach((epc) => {
            const urn = epc.textContent || '';
            if (urn.includes('sgtin')) {
              const parsed = parseSGTIN(urn);
              if (parsed) {
                const key = parsed.gtin14 + parsed.serial;
                lotExpiryMap.set(key, { lot, expiry: expiryYYMMDD });
              }
            }
          });
        } catch (error) {
          console.error('Error parsing expiry date:', expiryDate, error);
        }
      }
    });

    // Parse AggregationEvents to build hierarchy
    const parentChildMap = new Map<string, string>(); // child serial -> parent SSCC

    const aggregationEvents = xmlDoc.querySelectorAll('AggregationEvent');
    aggregationEvents.forEach((event, eventIndex) => {
      const parentIDNode = event.querySelector('parentID');
      if (!parentIDNode) return;

      const parentURN = parentIDNode.textContent || '';
      const parentParsed = parseSSCC(parentURN);

      if (!parentParsed) {
        errors.push({
          error: `Failed to parse parent SSCC: ${parentURN}`,
          row: { eventIndex },
        });
        return;
      }

      casesSet.add(parentParsed.sscc18);

      // Get all child EPCs
      const childEPCs = event.querySelectorAll('childEPCs > epc');
      childEPCs.forEach((epc) => {
        const urn = epc.textContent || '';
        if (urn.includes('sgtin')) {
          const parsed = parseSGTIN(urn);
          if (parsed) {
            parentChildMap.set(parsed.serial, parentParsed.sscc18);
          }
        }
      });
    });

    // Build final units array
    const allSGTINs = new Set<string>();

    // Re-parse all SGTINs from ObjectEvents
    objectEvents.forEach((event, eventIndex) => {
      const epcs = event.querySelectorAll('epcList > epc');
      epcs.forEach((epc) => {
        const urn = epc.textContent || '';
        if (urn.includes('sgtin')) {
          allSGTINs.add(urn);
        }
      });
    });

    // Also get SGTINs from AggregationEvents
    aggregationEvents.forEach((event) => {
      const childEPCs = event.querySelectorAll('childEPCs > epc');
      childEPCs.forEach((epc) => {
        const urn = epc.textContent || '';
        if (urn.includes('sgtin')) {
          allSGTINs.add(urn);
        }
      });
    });

    // Convert all SGTINs to ParsedUnit format
    allSGTINs.forEach((urn) => {
      const parsed = parseSGTIN(urn);
      if (!parsed) {
        errors.push({
          error: `Failed to parse SGTIN: ${urn}`,
          row: { urn },
        });
        return;
      }

      const key = parsed.gtin14 + parsed.serial;
      const lotExpiry = lotExpiryMap.get(key) || { lot: '', expiry: '' };
      const parentSerial = parentChildMap.get(parsed.serial);

      gtinsSet.add(parsed.gtin14);

      units.push({
        gtin: parsed.gtin14,
        serial: parsed.serial,
        lot: lotExpiry.lot,
        expiryYYMMDD: lotExpiry.expiry,
        parentSerial: parentSerial,
      });
    });

    return {
      units,
      errors,
      summary: {
        totalUnits: units.length,
        totalCases: casesSet.size,
        totalPallets: palletsSet.size,
        lots: Array.from(lotsSet),
        gtins: Array.from(gtinsSet),
      },
    };
  } catch (error) {
    errors.push({
      error: error instanceof Error ? error.message : 'Unknown error parsing EPCIS XML',
      row: {},
    });

    return {
      units: [],
      errors,
      summary: {
        totalUnits: 0,
        totalCases: 0,
        totalPallets: 0,
        lots: [],
        gtins: [],
      },
    };
  }
}
