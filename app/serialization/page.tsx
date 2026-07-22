'use client';

import { useState, useEffect } from 'react';
import { CodeCard } from '@/components/CodeCard';
import { buildUnitCode, appKey, validateGtin, parseCombinedGtinSerial } from '@/lib/gs1';
import Link from 'next/link';

export default function SerializationPage() {
  const [gtin, setGtin] = useState('12345600001234');
  const [serial, setSerial] = useState('3000000000000013');
  const [lot, setLot] = useState('LOT002');
  const [expiry, setExpiry] = useState('290630');
  const [mode, setMode] = useState<'gs1' | 'plain' | 'combined' | 'gs1-no-lot'>('combined');
  const [enforceCheckDigit, setEnforceCheckDigit] = useState(false);

  // Combined input mode
  const [combinedInput, setCombinedInput] = useState('123456000012343000000000000013');
  const [parseError, setParseError] = useState<string | null>(null);

  const [gtinValidation, setGtinValidation] = useState<ReturnType<typeof validateGtin> | null>(null);
  const [generatedCode, setGeneratedCode] = useState<ReturnType<typeof buildUnitCode> | null>(null);
  const [generatedAppKey, setGeneratedAppKey] = useState<string | null>(null);

  useEffect(() => {
    if (gtin.length > 0) {
      try {
        const validation = validateGtin(gtin);
        setGtinValidation(validation);
      } catch (err) {
        setGtinValidation(null);
      }
    } else {
      setGtinValidation(null);
    }
  }, [gtin]);

  const handleGenerate = () => {
    try {
      let finalGtin = gtin;
      let finalSerial = serial;

      // If combined mode, parse the combined input first
      if (mode === 'combined') {
        const parsed = parseCombinedGtinSerial(combinedInput);
        if ('error' in parsed) {
          setParseError(parsed.error);
          return;
        }
        finalGtin = parsed.gtin;
        finalSerial = parsed.serial;
        setParseError(null);
        // Update individual fields for display
        setGtin(parsed.gtin);
        setSerial(parsed.serial);
      }

      const code = buildUnitCode(finalGtin, finalSerial, {
        mode: mode === 'combined' ? 'gs1' : mode === 'gs1-no-lot' ? 'gs1' : mode,
        lot: (mode === 'gs1' || mode === 'combined') ? lot : undefined,
        expiryYYMMDD: (mode === 'gs1' || mode === 'combined' || mode === 'gs1-no-lot') ? expiry : undefined,
      });
      setGeneratedCode(code);
      setGeneratedAppKey(appKey(finalGtin, finalSerial));
    } catch (err) {
      console.error('Error generating code:', err);
    }
  };

  const handleFixGtin = () => {
    if (gtinValidation?.corrected) {
      setGtin(gtinValidation.corrected);
    }
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
                <Link href="/" className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors">
                  Batch Upload
                </Link>
                <Link href="/serialization" className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-900 bg-slate-100 rounded-md">
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
              Single Serialization Generator
            </h1>
            <p className="text-sm text-slate-600">
              Generate a barcode for a single vial or unit
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Form */}
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <h2 className="text-base font-semibold mb-4 text-slate-900">
                Product Information
              </h2>

              {/* Mode Toggle */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Encoding Mode
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <label className="flex items-center cursor-pointer group hover:bg-slate-50 p-2 rounded-md transition-colors">
                    <input
                      type="radio"
                      value="combined"
                      checked={mode === 'combined'}
                      onChange={() => setMode('combined')}
                      className="mr-2"
                    />
                    <span className="text-sm text-slate-900 flex items-center gap-2">
                      Combined Input (Parse GTIN+Serial from single string)
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                        RECOMMENDED
                      </span>
                    </span>
                  </label>
                  <label className="flex items-center cursor-pointer group hover:bg-slate-50 p-2 rounded-md transition-colors">
                    <input
                      type="radio"
                      value="gs1"
                      checked={mode === 'gs1'}
                      onChange={() => setMode('gs1')}
                      className="mr-2"
                    />
                    <span className="text-sm text-slate-900">
                      GS1 Full (GTIN + Serial + Lot + Expiry)
                    </span>
                  </label>
                  <label className="flex items-center cursor-pointer group hover:bg-slate-50 p-2 rounded-md transition-colors">
                    <input
                      type="radio"
                      value="gs1-no-lot"
                      checked={mode === 'gs1-no-lot'}
                      onChange={() => setMode('gs1-no-lot')}
                      className="mr-2"
                    />
                    <span className="text-sm text-slate-900">
                      GS1 No Lot (GTIN + Serial + Expiry only)
                    </span>
                  </label>
                  <label className="flex items-center cursor-pointer group hover:bg-slate-50 p-2 rounded-md transition-colors">
                    <input
                      type="radio"
                      value="plain"
                      checked={mode === 'plain'}
                      onChange={() => setMode('plain')}
                      className="mr-2"
                    />
                    <span className="text-sm text-slate-900">
                      Plain (GTIN + Serial only)
                    </span>
                  </label>
                </div>
              </div>

              {/* Combined Input Mode */}
              {mode === 'combined' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Combined GTIN+Serial String
                  </label>
                  <input
                    type="text"
                    value={combinedInput}
                    onChange={(e) => setCombinedInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 bg-white text-slate-900 font-mono"
                    placeholder="123456000012343000000000000013"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Enter GTIN and Serial concatenated together (e.g., 14-digit GTIN + serial)
                  </p>
                  {parseError && (
                    <p className="mt-1.5 text-xs text-red-600">
                      {parseError}
                    </p>
                  )}
                </div>
              )}

              {/* GTIN */}
              {mode !== 'combined' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    GTIN (8/12/13/14 digits)
                  </label>
                  <input
                    type="text"
                    value={gtin}
                    onChange={(e) => setGtin(e.target.value.replace(/\D/g, ''))}
                    maxLength={14}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 bg-white text-slate-900"
                    placeholder="12345600001234"
                  />
                  {gtinValidation && !gtinValidation.checkDigitValid && (
                    <div className="mt-1.5">
                      <p className="text-xs text-orange-600">
                        {enforceCheckDigit ? 'Invalid check digit' : 'Warning: Check digit mismatch'}
                      </p>
                      <button
                        onClick={handleFixGtin}
                        className="mt-1 text-xs text-slate-600 hover:text-slate-900 underline"
                      >
                        Fix to: {gtinValidation.corrected}
                      </button>
                    </div>
                  )}
                  <label className="flex items-center mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enforceCheckDigit}
                      onChange={(e) => setEnforceCheckDigit(e.target.checked)}
                      className="mr-2 w-4 h-4 text-slate-900 rounded border-slate-300 focus:ring-2 focus:ring-slate-400 focus:ring-offset-0"
                    />
                    <span className="text-xs text-slate-600">
                      Enforce valid GS1 check digit
                    </span>
                  </label>
                </div>
              )}

              {/* Serial */}
              {mode !== 'combined' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Serial Number (up to 20 alphanumeric)
                  </label>
                  <input
                    type="text"
                    value={serial}
                    onChange={(e) => setSerial(e.target.value)}
                    maxLength={20}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 bg-white text-slate-900"
                    placeholder="3000000000000013"
                  />
                </div>
              )}

              {/* Lot (GS1 Full mode only) */}
              {(mode === 'gs1' || mode === 'combined') && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Lot Number (up to 20 alphanumeric)
                  </label>
                  <input
                    type="text"
                    value={lot}
                    onChange={(e) => setLot(e.target.value)}
                    maxLength={20}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 bg-white text-slate-900"
                    placeholder="LOT002"
                  />
                </div>
              )}

              {/* Expiry (All GS1 modes) */}
              {(mode === 'gs1' || mode === 'combined' || mode === 'gs1-no-lot') && (
                <div className="mb-5">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Expiry Date (YYMMDD)
                  </label>
                  <input
                    type="text"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    maxLength={6}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 bg-white text-slate-900"
                    placeholder="290630"
                  />
                  {expiry.length > 0 && expiry.length !== 6 && (
                    <p className="mt-1.5 text-xs text-orange-600">
                      Expiry must be exactly 6 digits (YYMMDD)
                    </p>
                  )}
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={
                  (mode === 'combined' && !combinedInput) ||
                  (mode !== 'combined' && (!gtin || !serial)) ||
                  (mode === 'gs1' && (!lot || expiry.length !== 6)) ||
                  (mode === 'combined' && (!lot || expiry.length !== 6)) ||
                  (mode === 'gs1-no-lot' && expiry.length !== 6) ||
                  (enforceCheckDigit && gtinValidation !== null && !gtinValidation.checkDigitValid)
                }
                className="w-full px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium transition-colors text-sm"
              >
                Generate Barcode
              </button>
            </div>

            {/* Output Card */}
            <div>
              {generatedCode && generatedAppKey ? (
                <div className="space-y-4">
                  <CodeCard
                    bcid={generatedCode.bcid}
                    text={generatedCode.text}
                    appKey={generatedAppKey}
                    symbologyBadge={
                      mode === 'plain' ? 'DataMatrix' :
                      mode === 'gs1-no-lot' ? ']d2 GS1 (No Lot)' :
                      ']d2 GS1'
                    }
                    title="Serialization Barcode"
                  />

                  {/* Additional Info */}
                  <div className="bg-slate-50 rounded-md border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold mb-2 text-slate-900">
                      Details
                    </h3>
                    <div className="space-y-1 text-xs text-slate-700">
                      <p>
                        <strong>GTIN:</strong> {gtin}
                      </p>
                      <p>
                        <strong>Serial:</strong> {serial}
                      </p>
                      {(mode === 'gs1' || mode === 'combined') && (
                        <p>
                          <strong>Lot:</strong> {lot}
                        </p>
                      )}
                      {(mode === 'gs1' || mode === 'combined' || mode === 'gs1-no-lot') && (
                        <p>
                          <strong>Expiry:</strong> {expiry}
                        </p>
                      )}
                      <p>
                        <strong>Symbology:</strong> {generatedCode.bcid === 'gs1datamatrix' ? 'GS1 DataMatrix' : 'DataMatrix'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-slate-200 p-6 text-center text-slate-500">
                  Fill in the product information and click Generate Barcode
                </div>
              )}
            </div>
          </div>

          {/* Info Panel */}
          <div className="mt-6 bg-slate-100 rounded-lg border border-slate-200 p-5">
            <h3 className="text-base font-semibold mb-3 text-slate-900">
              Serialization Barcode Info
            </h3>
            <div className="space-y-2.5 text-sm text-slate-700">
              <p>
                <strong>GS1 Full:</strong> Encodes GTIN (AI 01), Serial (AI 21), Lot (AI 10), and Expiry (AI 17) as GS1 DataMatrix. This is the industry standard for pharmaceutical unit serialization.
              </p>
              <p>
                <strong>GS1 No Lot:</strong> Encodes GTIN (AI 01), Serial (AI 21), and Expiry (AI 17) only - omits lot number. Useful when lot tracking is not required.
              </p>
              <p>
                <strong>Plain Mode:</strong> Encodes only GTIN and Serial as a plain DataMatrix without GS1 Application Identifiers. Use this for internal tracking or non-GS1 systems.
              </p>
              <p>
                <strong>Combined Input:</strong> Automatically parses GTIN and Serial from a single concatenated string (e.g., "123456000012343000000000000013"). The app detects GTIN length and separates it from the serial.
              </p>
              <p>
                <strong>App Key:</strong> The combination of GTIN and Serial uniquely identifies this unit across your supply chain.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
