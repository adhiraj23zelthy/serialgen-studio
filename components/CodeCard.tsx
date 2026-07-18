'use client';

import { useEffect, useRef, useState } from 'react';
import bwipjs from 'bwip-js';

interface CodeCardProps {
  bcid: string;
  text: string;
  appKey?: string;
  symbologyBadge?: string;
  title?: string;
}

export function CodeCard({ bcid, text, appKey, symbologyBadge, title }: CodeCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState<'text' | 'appKey' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      const canvas = canvasRef.current;

      // Clear any previous error
      setError(null);

      // Render barcode with quiet zone
      const options: any = {
        bcid: bcid as any,
        text: text,
        scale: bcid.includes('datamatrix') ? 3 : 2, // Smaller scale
        height: bcid.includes('datamatrix') ? 10 : 8,
        paddingwidth: 8,
        paddingheight: 8,
        backgroundcolor: 'ffffff',
        barcolor: '000000',
      };

      // For GS1 DataMatrix, disable validation to allow non-standard GTINs
      if (bcid === 'gs1datamatrix') {
        options.dontlint = true; // Disable GS1 AI validation
        console.log('Encoding GS1 DataMatrix with dontlint:', text);
      }

      bwipjs.toCanvas(canvas, options);
    } catch (err) {
      console.error('Error rendering barcode:', err);
      setError(err instanceof Error ? err.message : 'Failed to render barcode');
    }
  }, [bcid, text]);

  const handleCopy = async (value: string, type: 'text' | 'appKey') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;

    canvasRef.current.toBlob((blob) => {
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${appKey || text.substring(0, 20)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow duration-200">
      {title && (
        <h3 className="text-sm font-semibold mb-3 text-slate-900">
          {title}
        </h3>
      )}

      {/* Barcode Canvas - Always black on white */}
      <div className="flex justify-center items-center mb-3 p-4 bg-white rounded-md border border-slate-200 overflow-hidden" style={{ maxHeight: '180px' }}>
        {error ? (
          <div className="text-red-600 text-sm p-4">
            Error: {error}
          </div>
        ) : (
          <canvas ref={canvasRef} className="max-w-full h-auto" />
        )}
      </div>

      {/* Symbology Badge */}
      {symbologyBadge && (
        <div className="mb-3">
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium font-mono bg-slate-100 text-slate-600 rounded">
            {symbologyBadge}
          </span>
        </div>
      )}

      {/* Encoded String */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-slate-600">
            Encoded String
          </label>
          <button
            onClick={() => handleCopy(text, 'text')}
            className="text-xs text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1"
          >
            {copied === 'text' ? (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Copied</span>
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <code className="block p-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-mono break-all text-slate-900">
          {text}
        </code>
      </div>

      {/* App Key */}
      {appKey && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-600">
              App Key
            </label>
            <button
              onClick={() => handleCopy(appKey, 'appKey')}
              className="text-xs text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1"
            >
              {copied === 'appKey' ? (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <code className="block p-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-mono break-all text-slate-900">
            {appKey}
          </code>
        </div>
      )}

      {/* Download Button */}
      <button
        onClick={handleDownload}
        className="w-full px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-medium transition-colors flex items-center justify-center gap-2 text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download PNG
      </button>
    </div>
  );
}
