'use client';

import { useState, useRef } from 'react';
import { CodeCard } from '@/components/CodeCard';
import { validateGtin, buildUnitCode, appKey, expiryToYYMMDD, parseHierarchyRow } from '@/lib/gs1';
import { parseEPCISXML } from '@/lib/epcis-parser';
import Papa from 'papaparse';
import Link from 'next/link';

interface ProcessedUnit {
  gtin: string;
  serial: string;
  lot: string;
  expiryYYMMDD: string;
  parentSerial?: string;
  palletSerial?: string;
  appKey: string;
  code: ReturnType<typeof buildUnitCode>;
}

export default function Home() {
  // Batch upload state
  const [parsedUnits, setParsedUnits] = useState<ProcessedUnit[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [includeLotExpiry, setIncludeLotExpiry] = useState(false);
  const [batchViewTab, setBatchViewTab] = useState<'pallets' | 'cases' | 'serializations'>('pallets');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download progress state
  const [downloadProgress, setDownloadProgress] = useState<{
    current: number;
    total: number;
    isDownloading: boolean;
  }>({ current: 0, total: 0, isDownloading: false });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 100;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setParsedUnits([]);
    setErrors([]);

    // Detect file type
    const isXML = file.name.toLowerCase().endsWith('.xml');
    const isCSV = file.name.toLowerCase().endsWith('.csv');

    if (isXML) {
      // Handle EPCIS XML
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const xmlContent = event.target?.result as string;
          const result = parseEPCISXML(xmlContent);

          const units: ProcessedUnit[] = result.units.map((unit) => {
            const code = buildUnitCode(unit.gtin, unit.serial, {
              mode: 'gs1',
              lot: includeLotExpiry ? unit.lot : undefined,
              expiryYYMMDD: includeLotExpiry ? unit.expiryYYMMDD : undefined,
            });

            return {
              ...unit,
              appKey: appKey(unit.gtin, unit.serial),
              code,
            };
          });

          setParsedUnits(units);
          setErrors(result.errors.map((err, i) => ({
            rowNumber: i + 1,
            error: err.error,
          })));
          setLoading(false);
        } catch (error) {
          console.error('XML parsing error:', error);
          setErrors([{ error: error instanceof Error ? error.message : 'Failed to parse XML' }]);
          setLoading(false);
        }
      };
      reader.onerror = () => {
        setErrors([{ error: 'Failed to read XML file' }]);
        setLoading(false);
      };
      reader.readAsText(file);
    } else if (isCSV) {
      // Handle CSV
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
    } else {
      setErrors([{ error: 'Unsupported file type. Please upload a CSV or XML file.' }]);
      setLoading(false);
    }
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
    const bwipjs = (await import('bwip-js')).default;

    const zip = new JSZip();
    const unitsFolder = zip.folder('units');
    const casesFolder = zip.folder('cases');
    const palletsFolder = zip.folder('pallets');

    const totalItems = parsedUnits.length + uniqueCases.size + uniquePallets.size;
    let currentItem = 0;

    // Set initial progress
    setDownloadProgress({ current: 0, total: totalItems, isDownloading: true });

    // Helper to generate barcode and update progress
    const generateBarcode = async (bcid: string, text: string, options: any = {}) => {
      const canvas = document.createElement('canvas');

      const barcodeOptions: any = {
        bcid: bcid as any,
        text: text,
        scale: bcid.includes('datamatrix') ? 3 : 2,
        height: bcid.includes('datamatrix') ? 10 : 8,
        paddingwidth: 8,
        paddingheight: 8,
        backgroundcolor: 'ffffff',
        barcolor: '000000',
        ...options,
      };

      if (bcid === 'gs1datamatrix') {
        barcodeOptions.dontlint = true;
      }

      bwipjs.toCanvas(canvas, barcodeOptions);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!));
      });

      currentItem++;
      setDownloadProgress({ current: currentItem, total: totalItems, isDownloading: true });

      return blob;
    };

    // Process in batches to keep UI responsive
    const BATCH_SIZE = 50;

    // Generate unit barcodes in batches
    for (let i = 0; i < parsedUnits.length; i += BATCH_SIZE) {
      const batch = parsedUnits.slice(i, i + BATCH_SIZE);

      // Process batch
      for (const unit of batch) {
        const blob = await generateBarcode(unit.code.bcid, unit.code.text);
        unitsFolder?.file(`${unit.appKey}.png`, blob);
      }

      // Give browser a break between batches
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Generate case barcodes in batches
    const caseArray = Array.from(uniqueCases).filter(Boolean);
    for (let i = 0; i < caseArray.length; i += BATCH_SIZE) {
      const batch = caseArray.slice(i, i + BATCH_SIZE);

      for (const caseSerial of batch) {
        if (!caseSerial) continue;
        const blob = await generateBarcode('code128', caseSerial);
        casesFolder?.file(`case_${caseSerial}.png`, blob);
      }

      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Generate pallet barcodes in batches
    const palletArray = Array.from(uniquePallets).filter(Boolean);
    for (let i = 0; i < palletArray.length; i += BATCH_SIZE) {
      const batch = palletArray.slice(i, i + BATCH_SIZE);

      for (const palletSerial of batch) {
        if (!palletSerial) continue;
        const blob = await generateBarcode('code128', palletSerial);
        palletsFolder?.file(`pallet_${palletSerial}.png`, blob);
      }

      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Generate ZIP file
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'barcodes.zip');

    // Reset progress
    setDownloadProgress({ current: 0, total: 0, isDownloading: false });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-900 rounded-md flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <span className="text-lg font-semibold text-slate-900">
                  SerialGen Studio
                </span>
              </div>
              <div className="flex gap-1">
                <Link href="/" className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-900 bg-slate-100 rounded-md">
                  Batch Upload
                </Link>
                <Link href="/serialization" className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors">
                  Serialization
                </Link>
                <Link href="/case" className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors">
                  Case & Pallet
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-900 mb-1">
              Batch Upload
            </h1>
            <p className="text-sm text-slate-600">
              Upload CSV to generate all barcodes: serializations, cases, and pallets
            </p>
          </div>

          <div>
              {/* File Upload */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mb-6">
                {/* Upload Area */}
                <div className="p-5 border-b border-slate-200">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xml"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex items-center gap-3 p-4 border-2 border-dashed border-slate-300 rounded-lg hover:border-slate-400 hover:bg-slate-50 transition-all group"
                  >
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-slate-200 transition-colors">
                      <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 group-hover:text-slate-700">
                        Click to upload CSV or EPCIS XML file
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        Supports CSV hierarchy format or EPCIS 1.1/1.2 XML
                      </p>
                    </div>
                    <div className="hidden sm:block shrink-0">
                      <div className="px-3 py-1.5 bg-slate-100 rounded-md text-xs font-medium text-slate-700 group-hover:bg-slate-200 transition-colors">
                        Browse
                      </div>
                    </div>
                  </label>
                </div>

                {/* Options */}
                <div className="px-5 py-3 bg-slate-50">
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={includeLotExpiry}
                        onChange={(e) => setIncludeLotExpiry(e.target.checked)}
                        className="w-4 h-4 text-slate-900 rounded border-slate-300 focus:ring-2 focus:ring-slate-400 focus:ring-offset-0"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 group-hover:text-slate-700">
                          Include Lot & Expiry Date
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          (AI 10, 17)
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Encode lot number and expiration date in barcode
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {loading && (
                <div className="text-center py-8">
                  <div className="text-sm text-slate-600">Processing CSV...</div>
                </div>
              )}

              {/* Summary */}
              {parsedUnits.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 p-5 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">
                        Processing Complete
                      </h2>
                      <p className="text-sm text-slate-600">
                        {parsedUnits.length} units parsed from CSV
                      </p>
                    </div>
                    <button
                      onClick={handleDownloadAll}
                      disabled={downloadProgress.isDownloading}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors flex items-center gap-2 text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {downloadProgress.isDownloading ? 'Generating...' : 'Download ZIP'}
                    </button>
                  </div>

                  {/* Progress Bar */}
                  {downloadProgress.isDownloading && (
                    <div className="mb-4 bg-slate-50 rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-700">
                          Generating barcodes...
                        </span>
                        <span className="text-sm font-medium text-slate-900">
                          {downloadProgress.current} / {downloadProgress.total}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-slate-900 h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-600 mt-2">
                        {Math.round((downloadProgress.current / downloadProgress.total) * 100)}% complete
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-slate-50 rounded-md p-3">
                      <div className="text-xs font-medium text-slate-600 mb-1">Pallets</div>
                      <div className="text-xl font-semibold text-slate-900">{uniquePallets.size}</div>
                    </div>
                    <div className="bg-slate-50 rounded-md p-3">
                      <div className="text-xs font-medium text-slate-600 mb-1">Cases</div>
                      <div className="text-xl font-semibold text-slate-900">{uniqueCases.size}</div>
                    </div>
                    <div className="bg-slate-50 rounded-md p-3">
                      <div className="text-xs font-medium text-slate-600 mb-1">Serializations</div>
                      <div className="text-xl font-semibold text-slate-900">{parsedUnits.length}</div>
                    </div>
                    <div className="bg-slate-50 rounded-md p-3">
                      <div className="text-xs font-medium text-slate-600 mb-1">Lots</div>
                      <div className="text-xs text-slate-900 font-mono truncate">{Array.from(uniqueLots).join(', ')}</div>
                    </div>
                    <div className="bg-slate-50 rounded-md p-3">
                      <div className="text-xs font-medium text-slate-600 mb-1">GTINs</div>
                      <div className="text-xs text-slate-900 font-mono truncate">{Array.from(uniqueGtins).join(', ')}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Errors */}
              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <h3 className="text-base font-semibold text-red-900 mb-2">
                    Errors ({errors.length})
                  </h3>
                  <div className="space-y-1 text-sm text-red-800">
                    {errors.map((err, i) => (
                      <div key={i}>
                        Row {err.rowNumber}: {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Barcode Tabs */}
              {parsedUnits.length > 0 && (
                <>
                  <div className="mb-4">
                    <div className="inline-flex gap-1 bg-slate-100 p-1 rounded-lg">
                      <button
                        onClick={() => {
                          setBatchViewTab('pallets');
                          setCurrentPage(1);
                        }}
                        className={`${
                          batchViewTab === 'pallets'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        } px-3 py-1.5 rounded-md font-medium text-sm transition-all flex items-center gap-1.5`}
                      >
                        Pallets
                        <span className={`${
                          batchViewTab === 'pallets' ? 'bg-slate-100' : 'bg-slate-200'
                        } px-1.5 py-0.5 rounded text-xs font-semibold`}>
                          {uniquePallets.size}
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          setBatchViewTab('cases');
                          setCurrentPage(1);
                        }}
                        className={`${
                          batchViewTab === 'cases'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        } px-3 py-1.5 rounded-md font-medium text-sm transition-all flex items-center gap-1.5`}
                      >
                        Cases
                        <span className={`${
                          batchViewTab === 'cases' ? 'bg-slate-100' : 'bg-slate-200'
                        } px-1.5 py-0.5 rounded text-xs font-semibold`}>
                          {uniqueCases.size}
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          setBatchViewTab('serializations');
                          setCurrentPage(1);
                        }}
                        className={`${
                          batchViewTab === 'serializations'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        } px-3 py-1.5 rounded-md font-medium text-sm transition-all flex items-center gap-1.5`}
                      >
                        Serializations
                        <span className={`${
                          batchViewTab === 'serializations' ? 'bg-slate-100' : 'bg-slate-200'
                        } px-1.5 py-0.5 rounded text-xs font-semibold`}>
                          {parsedUnits.length}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Pallets Tab */}
                  {batchViewTab === 'pallets' && uniquePallets.size > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Array.from(uniquePallets).map((palletSerial, index) => (
                        <CodeCard
                          key={`pallet-${index}`}
                          bcid="code128"
                          text={palletSerial!}
                          symbologyBadge="Code 128"
                          title={`Pallet ${index + 1}`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Cases Tab */}
                  {batchViewTab === 'cases' && uniqueCases.size > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Array.from(uniqueCases).map((caseSerial, index) => (
                        <CodeCard
                          key={`case-${index}`}
                          bcid="code128"
                          text={caseSerial!}
                          symbologyBadge="Code 128"
                          title={`Case ${index + 1}`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Serializations Tab */}
                  {batchViewTab === 'serializations' && (
                    <>
                      {/* Filter */}
                      <div className="mb-4">
                        <input
                          type="text"
                          value={filter}
                          onChange={(e) => {
                            setFilter(e.target.value);
                            setCurrentPage(1); // Reset to first page when filtering
                          }}
                          placeholder="Filter by serial, case, or pallet..."
                          className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 bg-white text-slate-900 placeholder-slate-400"
                        />
                      </div>

                      {/* Pagination Info */}
                      {filteredUnits.length > ITEMS_PER_PAGE && (
                        <div className="mb-4 flex items-center justify-between">
                          <p className="text-sm text-slate-600">
                            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredUnits.length)} of {filteredUnits.length} serializations
                          </p>
                        </div>
                      )}

                      {/* Units Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredUnits
                          .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                          .map((unit, index) => (
                            <CodeCard
                              key={index}
                              bcid={unit.code.bcid}
                              text={unit.code.text}
                              appKey={unit.appKey}
                              symbologyBadge="]d2 GS1"
                              title={`Serialization ${((currentPage - 1) * ITEMS_PER_PAGE) + index + 1}`}
                            />
                          ))}
                      </div>

                      {/* Pagination Controls */}
                      {filteredUnits.length > ITEMS_PER_PAGE && (
                        <div className="mt-6 flex items-center justify-center gap-2">
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>

                          <span className="text-sm text-slate-600">
                            Page {currentPage} of {Math.ceil(filteredUnits.length / ITEMS_PER_PAGE)}
                          </span>

                          <button
                            onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredUnits.length / ITEMS_PER_PAGE), p + 1))}
                            disabled={currentPage >= Math.ceil(filteredUnits.length / ITEMS_PER_PAGE)}
                            className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {parsedUnits.length === 0 && !loading && (
                <div className="text-center py-12 text-slate-500">
                  Upload a CSV file to get started
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}
