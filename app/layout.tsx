import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SerialGen Studio - GS1 Barcode Generator",
  description: "Professional GS1 DataMatrix and Code 128 barcode generator for pharmaceutical serialization, cases, and pallets. Batch CSV processing with GTIN validation.",
  keywords: ["GS1", "DataMatrix", "Code 128", "barcode generator", "serialization", "GTIN", "pharmaceutical", "supply chain", "traceability"],
  authors: [{ name: "SerialGen Studio" }],
  openGraph: {
    title: "SerialGen Studio - GS1 Barcode Generator",
    description: "Professional barcode generation for pharmaceutical serialization and logistics",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
