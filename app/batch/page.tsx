'use client';

import { useState, useRef } from 'react';
import { CodeCard } from '@/components/CodeCard';
import { parseHierarchyRow, buildUnitCode, appKey, buildLogisticsCode, ParsedUnit } from '@/lib/gs1';
import Papa from 'papaparse';
import Link from 'next/link';

interface ProcessedUnit extends ParsedUnit {
  appKey: string;
  code: ReturnType<typeof buildUnitCode>;
}

export default function BatchPage() {
  const [parsedUnits, setParsedUnits] = useState<ProcessedUnit[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [includeLotExpiry, setIncludeLotExpiry] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setParsedUnits([]);
    setErrors([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const units: ProcessedUnit[] = [];
        const parseErrors: any[] = [];

        results.data.forEach((row: any, index) => {
          const parsed = parseHierarchyRow(row);

          if ('error' in parsed) {
            parseErrors.push({ rowNumber: index + 2, error: parsed.error, row: parsed.row });
          } else {
            // Build unit code - optionally include lot/expiry
            const code = buildUnitCode(parsed.gtin, parsed.serial, {
              mode: 'gs1',
              lot: includeLotExpiry ? parsed.lot : undefined,
              expiryYYMMDD: includeLotExpiry ? parsed.expiryYYMMDD : undefined,
            });

            units.push({
              ...parsed,
              appKey: appKey(parsed.gtin, parsed.serial),
              code,
            });
          }
        });

        setParsedUnits(units);
        setErrors(parseErrors);
        setLoading(false);
      },
      error: (error) => {
        console.error('CSV parsing error:', error);
        setErrors([{ error: error.message }]);
        setLoading(false);
      },
    });
  };

  const filteredUnits = parsedUnits.filter((unit) => {
    if (!filter) return true;
    return (
      unit.appKey.includes(filter) ||
      unit.serial.includes(filter) ||
      unit.parentSerial?.includes(filter) ||
      unit.palletSerial?.includes(filter)
    );
  });

  const uniqueCases = new Set(parsedUnits.map((u) => u.parentSerial).filter(Boolean));
  const uniquePallets = new Set(parsedUnits.map((u) => u.palletSerial).filter(Boolean));
  const uniqueLots = new Set(parsedUnits.map((u) => u.lot));
  const uniqueExpiries = new Set(parsedUnits.map((u) => u.expiryYYMMDD));
  const uniqueGtins = new Set(parsedUnits.map((u) => u.gtin));

  const handleDownloadAll = async () => {
    const JSZip = (await import('jszip')).default;
    const { saveAs } = await import('file-saver');
    const zip = new JSZip();

    // Create folders
    const unitsFolder = zip.folder('units');
    const casesFolder = zip.folder('cases');
    const palletsFolder = zip.folder('pallets');

    // Generate unit barcodes
    for (const unit of parsedUnits) {
      const canvas = document.createElement('canvas');
      const bwipjs = (await import('bwip-js')).default;

      const options: any = {
        bcid: unit.code.bcid as any,
        text: unit.code.text,
        scale: 4,
        height: 10,
        paddingwidth: 12,
        paddingheight: 12,
        backgroundcolor: 'ffffff',
        barcolor: '000000',
      };

      // For GS1 DataMatrix, disable validation to allow non-standard GTINs
      if (unit.code.bcid === 'gs1datamatrix') {
        options.dontlint = true;
      }

      bwipjs.toCanvas(canvas, options);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!));
      });

      unitsFolder?.file(`${unit.appKey}.png`, blob);
    }

    // Generate case barcodes
    for (const caseSerial of uniqueCases) {
      if (!caseSerial) continue;

      const canvas = document.createElement('canvas');
      const bwipjs = (await import('bwip-js')).default;

      bwipjs.toCanvas(canvas, {
        bcid: 'code128',
        text: caseSerial,
        scale: 4,
        height: 10,
        paddingwidth: 12,
        paddingheight: 12,
        backgroundcolor: 'ffffff',
        barcolor: '000000',
      });

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!));
      });

      casesFolder?.file(`case_${caseSerial}.png`, blob);
    }

    // Generate pallet barcodes
    for (const palletSerial of uniquePallets) {
      if (!palletSerial) continue;

      const canvas = document.createElement('canvas');
      const bwipjs = (await import('bwip-js')).default;

      bwipjs.toCanvas(canvas, {
        bcid: 'code128',
        text: palletSerial,
        scale: 4,
        height: 10,
        paddingwidth: 12,
        paddingheight: 12,
        backgroundcolor: 'ffffff',
        barcolor: '000000',
      });

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!));
      });

      palletsFolder?.file(`pallet_${palletSerial}.png`, blob);
    }

    // Generate and download ZIP
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'barcodes.zip');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex space-x-8">
              <Link href="/" className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300">
                Single Unit
              </Link>
              <Link href="/case" className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300">
                Case & Pallet
              </Link>
              <Link href="/batch" className="inline-flex items-center px-1 pt-1 border-b-2 border-blue-500 text-sm font-medium text-gray-900 dark:text-white">
                Batch CSV
              </Link>
              <Link href="/hierarchy" className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300">
                Hierarchy Tree
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Batch Hierarchy CSV Upload
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Upload a CSV file to generate barcodes for multiple units, cases, and pallets
          </p>

          {/* File Upload */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
            {/* Include Lot/Expiry Toggle */}
            <div className="mb-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeLotExpiry}
                  onChange={(e) => setIncludeLotExpiry(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Include Lot and Expiry Date in barcodes (AI 10, 17)
                </span>
              </label>
              <p className="mt-1 ml-6 text-xs text-gray-500 dark:text-gray-400">
                When unchecked, barcodes will only contain (01)GTIN(21)Serial
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 focus:outline-none"
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Upload a CSV file with columns: SerialNumber, ParentSerialNumber, PalletSerialNumber, CountryDrugCode, LotNumber, ExpirationDate
            </p>
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="text-lg text-gray-600 dark:text-gray-400">Processing CSV...</div>
            </div>
          )}

          {/* Summary */}
          {parsedUnits.length > 0 && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Summary
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div>
                  <div className="font-medium text-gray-700 dark:text-gray-300">Units</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{parsedUnits.length}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-700 dark:text-gray-300">Cases</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{uniqueCases.size}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-700 dark:text-gray-300">Pallets</div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{uniquePallets.size}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-700 dark:text-gray-300">Lots</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{Array.from(uniqueLots).join(', ')}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-700 dark:text-gray-300">GTINs</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{Array.from(uniqueGtins).join(', ')}</div>
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={handleDownloadAll}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
                >
                  Download All as ZIP ({parsedUnits.length} units + {uniqueCases.size} cases + {uniquePallets.size} pallets)
                </button>
              </div>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                Errors ({errors.length})
              </h3>
              <div className="space-y-1 text-sm text-red-700 dark:text-red-300">
                {errors.map((err, i) => (
                  <div key={i}>
                    Row {err.rowNumber}: {err.error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter */}
          {parsedUnits.length > 0 && (
            <div className="mb-4">
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by serial, case, or pallet..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          )}

          {/* Unit Grid */}
          {filteredUnits.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUnits.map((unit, index) => (
                <CodeCard
                  key={index}
                  bcid={unit.code.bcid}
                  text={unit.code.text}
                  appKey={unit.appKey}
                  symbologyBadge="]d2 GS1"
                  title={`Unit ${index + 1}`}
                />
              ))}
            </div>
          )}

          {parsedUnits.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              Upload a CSV file to get started
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
