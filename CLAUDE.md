# SerialGen Studio - AI Context

## Project Overview
Professional GS1-compliant barcode generator for pharmaceutical serialization and logistics. Next.js 16 app generating DataMatrix (units) and Code 128 (cases/pallets) barcodes.

## Tech Stack
- Next.js 16 (App Router) + TypeScript 5 + Tailwind CSS 4
- bwip-js (barcode rendering), papaparse (CSV), jszip (bulk downloads)

## Architecture

### Pages
- `/` - Batch CSV upload (10k+ rows, pagination, bulk ZIP download)
- `/serialization` - Single unit barcode generator
- `/case` - Case/pallet logistics barcodes

### Core Library (`lib/gs1.ts`)
- `validateGtin()` - GTIN validation with check digit auto-correction
- `buildUnitCode()` - DataMatrix generation (GS1/plain modes)
- `buildLogisticsCode()` - Code 128/GS1-128 with optional SSCC
- `parseHierarchyRow()` - Smart CSV parsing (element-string + app-key formats)
- `appKey()` - Mobile identifier (GTIN + Serial)

### Components
- `CodeCard` - Reusable barcode display with copy/download

## GS1 Standards
**Unit (]d2 GS1 DataMatrix):** `(01)GTIN(17)EXPIRY(10)LOT(21)SERIAL`
**Logistics (Code 128):** `17-digit serial`
**SSCC (GS1-128):** `(00)18-digit-SSCC`
**App Key:** `GTIN + Serial` (no AIs)

## Key Features
- Batch processing with progress tracking (50-item batches)
- Pagination (100 items/page)
- GTIN check digit validation
- Multiple date format support (YYMMDD, YYYY-MM-DD, etc.)
- Optional lot/expiry encoding toggle
- Bulk ZIP downloads (units/cases/pallets folders)

## Performance Notes
- Use `dontlint: true` for gs1datamatrix to bypass GTIN validation
- Batched barcode generation with 10ms delays for UI responsiveness
- Dynamic imports for heavy libraries (jszip, file-saver)

## Common Patterns
```typescript
// Generate unit barcode
const code = buildUnitCode(gtin14, serial, {
  mode: 'gs1',
  lot: 'LOT001',
  expiryYYMMDD: '290630'
});

// Validate GTIN
const validation = validateGtin(gtin);
if (!validation.checkDigitValid) {
  gtin = validation.corrected;
}
```

@AGENTS.md
