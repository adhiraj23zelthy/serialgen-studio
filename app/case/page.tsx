'use client';

import { useState } from 'react';
import { CodeCard } from '@/components/CodeCard';
import { buildLogisticsCode } from '@/lib/gs1';
import Link from 'next/link';

export default function CasePalletPage() {
  const [serial, setSerial] = useState('53911890305807601');
  const [type, setType] = useState<'case' | 'pallet'>('case');
  const [ssccify, setSsccify] = useState(false);

  const [generatedCode, setGeneratedCode] = useState<ReturnType<typeof buildLogisticsCode> | null>(null);

  const handleGenerate = () => {
    try {
      const code = buildLogisticsCode(serial, { ssccify });
      setGeneratedCode(code);
    } catch (err) {
      console.error('Error generating code:', err);
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
                <Link href="/serialization" className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors">
                  Serialization
                </Link>
                <Link href="/case" className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-900 bg-slate-100 rounded-md">
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
              Case & Pallet Generator
            </h1>
            <p className="text-sm text-slate-600">
              Generate Code 128 or GS1-128 barcodes for logistics
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Form */}
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <h2 className="text-base font-semibold mb-4 text-slate-900">
                Logistics Information
              </h2>

              {/* Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Type
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="case"
                      checked={type === 'case'}
                      onChange={() => {
                        setType('case');
                        setSerial('53911890305807601');
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-slate-900">
                      Case
                    </span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="pallet"
                      checked={type === 'pallet'}
                      onChange={() => {
                        setType('pallet');
                        setSerial('89012345678901250');
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-slate-900">
                      Pallet
                    </span>
                  </label>
                </div>
              </div>

              {/* Serial */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  17-Digit Serial Number
                </label>
                <input
                  type="text"
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  maxLength={17}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 bg-white text-slate-900"
                  placeholder="53911890305807601"
                />
                {serial.length !== 17 && serial.length > 0 && (
                  <p className="mt-1.5 text-xs text-orange-600">
                    Serial must be exactly 17 digits (current: {serial.length})
                  </p>
                )}
              </div>

              {/* SSCC-ify Toggle */}
              <div className="mb-5">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ssccify}
                    onChange={(e) => setSsccify(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-slate-900 rounded border-slate-300 focus:ring-2 focus:ring-slate-400 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-700">
                    SSCC-ify (compute 18th check digit and encode as GS1-128 with AI 00)
                  </span>
                </label>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={serial.length !== 17}
                className="w-full px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium transition-colors text-sm"
              >
                Generate Barcode
              </button>
            </div>

            {/* Output Card */}
            <div>
              {generatedCode ? (
                <div className="space-y-4">
                  <CodeCard
                    bcid={generatedCode.bcid}
                    text={generatedCode.text}
                    symbologyBadge={ssccify ? 'GS1-128 (SSCC)' : 'Code 128'}
                    title={`${type === 'case' ? 'Case' : 'Pallet'} Barcode`}
                  />

                  {/* Additional Info */}
                  <div className="bg-slate-50 rounded-md border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold mb-2 text-slate-900">
                      Details
                    </h3>
                    <div className="space-y-1 text-xs text-slate-700">
                      <p>
                        <strong>Raw Serial (17 digits):</strong> {serial}
                      </p>
                      {generatedCode.sscc18 && (
                        <p>
                          <strong>SSCC-18:</strong> {generatedCode.sscc18}
                        </p>
                      )}
                      <p>
                        <strong>Symbology:</strong> {generatedCode.bcid === 'gs1-128' ? 'GS1-128' : 'Code 128'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-slate-200 p-6 text-center text-slate-500">
                  Enter a 17-digit serial and click Generate Barcode
                </div>
              )}
            </div>
          </div>

          {/* Info Panel */}
          <div className="mt-6 bg-slate-100 rounded-lg border border-slate-200 p-5">
            <h3 className="text-base font-semibold mb-3 text-slate-900">
              Case & Pallet Barcode Info
            </h3>
            <div className="space-y-2.5 text-sm text-slate-700">
              <p>
                <strong>Default Mode (Code 128):</strong> Encodes the raw 17-digit serial number as a plain Code 128 barcode. This is a free-form serial identifier.
              </p>
              <p>
                <strong>SSCC Mode (GS1-128):</strong> Computes the 18th check digit using GS1 mod-10 algorithm and encodes as GS1-128 with Application Identifier (00) for Serial Shipping Container Code. This creates a valid 18-digit SSCC that conforms to GS1 standards.
              </p>
              <p>
                <strong>Use Case:</strong> Case serials identify individual cases/cartons. Pallet serials identify shipping pallets that contain multiple cases.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
