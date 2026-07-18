# SerialGen Studio — Professional GS1 Barcode Generator

![SerialGen Studio](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript) ![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

A professional Next.js application for generating GS1-compliant barcodes for pharmaceutical serialization and logistics. Supports **GS1 Data Matrix codes for units (vials)** and **Code 128 barcodes for cases and pallets**.

## Features

- 🔢 **Batch CSV Processing** - Upload CSV files with up to 10,000+ rows
- 📊 **Real-time Progress Tracking** - Visual progress bars for bulk operations
- ✅ **GTIN Validation** - GS1 check digit verification with auto-correction
- 📦 **Three Generation Modes:**
  - Batch Upload: Generate all barcodes from CSV
  - Single Serialization: Create individual unit barcodes
  - Case & Pallet: Generate logistics barcodes
- 🎯 **GS1 Compliance** - Support for DataMatrix (]d2) and plain mode (]d1)
- ⚡ **Performance Optimized** - Pagination, batched processing, and responsive UI
- 💾 **Bulk Download** - Export all barcodes as organized ZIP file

## Quick Start

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd matrix-generator

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Running Tests

```bash
npm test
```

## Usage

### Batch Upload

1. Navigate to "Batch Upload"
2. Upload a CSV file with columns: `SerialNumber`, `ParentSerialNumber`, `PalletSerialNumber`, `CountryDrugCode`, `LotNumber`, `ExpirationDate`
3. Toggle "Include Lot and Expiry Date" if needed
4. View generated barcodes in tabs: Pallets → Cases → Serializations
5. Click "Download ZIP" to export all barcodes

### Single Serialization

1. Navigate to "Serialization"
2. Enter GTIN, Serial Number, Lot, and Expiry
3. Choose between GS1 or Plain mode
4. Click "Generate Barcode"
5. Download individual PNG

### Case & Pallet

1. Navigate to "Case & Pallet"
2. Select type (Case or Pallet)
3. Enter 17-digit serial number
4. Optionally enable "SSCC-ify" for GS1-128 with AI (00)
5. Generate and download barcode

## Technical Details

### GS1 Standards

- **GS1 DataMatrix (]d2)**: Uses FNC1 and GS separators
  - Format: `(01)GTIN(17)EXPIRY(10)LOT(21)SERIAL`
- **Plain DataMatrix (]d1)**: Raw string without separators
  - Format: `01GTIN21SERIAL`
- **Code 128**: For case and pallet logistics
- **GS1-128**: With Application Identifier (00) for SSCC

### App Key Format

The mobile app identifier combines GTIN + Serial:
```
Barcode: (01)12345600001234(21)3000000000000013
App Key: 123456000012343000000000000013
```

### Performance

- **CSV Parsing**: ~2 seconds for 10,000 rows
- **UI Rendering**: Paginated (100 items per page)
- **Bulk Download**: ~3-5 minutes for 10,000 barcodes
  - Batched processing (50 items at a time)
  - Real-time progress updates
  - Responsive UI during generation

## Deployment

### Deploy to Vercel (Recommended)

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) and import repository
3. Vercel auto-detects Next.js configuration
4. Deploy with one click

### Deploy to Netlify

Build settings:
```
Build command: npm run build
Publish directory: .next
```

### Self-Hosted

```bash
npm run build
npm start
```

The app runs on `http://localhost:3000`

### Environment Variables

None required - the app runs entirely client-side.

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Barcode Generation**: bwip-js
- **CSV Parsing**: papaparse
- **Testing**: Vitest

## License

MIT

## Support

For issues or questions, please open a GitHub issue.
