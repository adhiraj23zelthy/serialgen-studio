'use client';

import { useState, useRef } from 'react';
import { CodeCard } from '@/components/CodeCard';
import { parseHierarchyRow, buildUnitCode, appKey, ParsedUnit } from '@/lib/gs1';
import Papa from 'papaparse';
import Link from 'next/link';

interface ProcessedUnit extends ParsedUnit {
  appKey: string;
  code: ReturnType<typeof buildUnitCode>;
}

interface TreeNode {
  type: 'pallet' | 'case' | 'unit';
  serial: string;
  children?: TreeNode[];
  unit?: ProcessedUnit;
}

export default function HierarchyPage() {
  const [parsedUnits, setParsedUnits] = useState<ProcessedUnit[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<ProcessedUnit | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const buildTree = (units: ProcessedUnit[]): TreeNode[] => {
    const pallets = new Map<string, TreeNode>();
    const cases = new Map<string, TreeNode>();

    // Build tree structure
    units.forEach((unit) => {
      // Get or create pallet node
      if (unit.palletSerial) {
        if (!pallets.has(unit.palletSerial)) {
          pallets.set(unit.palletSerial, {
            type: 'pallet',
            serial: unit.palletSerial,
            children: [],
          });
        }

        const palletNode = pallets.get(unit.palletSerial)!;

        // Get or create case node
        if (unit.parentSerial) {
          const caseKey = `${unit.palletSerial}-${unit.parentSerial}`;

          if (!cases.has(caseKey)) {
            const caseNode: TreeNode = {
              type: 'case',
              serial: unit.parentSerial,
              children: [],
            };
            cases.set(caseKey, caseNode);
            palletNode.children!.push(caseNode);
          }

          const caseNode = cases.get(caseKey)!;

          // Add unit to case
          caseNode.children!.push({
            type: 'unit',
            serial: unit.serial,
            unit,
          });
        }
      }
    });

    return Array.from(pallets.values());
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setParsedUnits([]);
    setTree([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const units: ProcessedUnit[] = [];

        results.data.forEach((row: any) => {
          const parsed = parseHierarchyRow(row);

          if (!('error' in parsed)) {
            const code = buildUnitCode(parsed.gtin, parsed.serial, {
              mode: 'gs1',
              lot: parsed.lot,
              expiryYYMMDD: parsed.expiryYYMMDD,
            });

            units.push({
              ...parsed,
              appKey: appKey(parsed.gtin, parsed.serial),
              code,
            });
          }
        });

        setParsedUnits(units);
        setTree(buildTree(units));
        setLoading(false);
      },
    });
  };

  const TreeNodeComponent = ({ node, level = 0 }: { node: TreeNode; level?: number }) => {
    const [expanded, setExpanded] = useState(true);

    const indent = level * 24;
    const bgColor =
      node.type === 'pallet'
        ? 'bg-purple-50 dark:bg-purple-900/20'
        : node.type === 'case'
        ? 'bg-green-50 dark:bg-green-900/20'
        : 'bg-blue-50 dark:bg-blue-900/20';

    const badge =
      node.type === 'pallet'
        ? 'bg-purple-600 text-white'
        : node.type === 'case'
        ? 'bg-green-600 text-white'
        : 'bg-blue-600 text-white';

    const childCount = node.children?.length || 0;

    return (
      <div style={{ marginLeft: `${indent}px` }} className="mb-2">
        <div
          className={`${bgColor} border border-gray-200 dark:border-gray-700 rounded-lg p-3 cursor-pointer`}
          onClick={() => {
            if (node.type === 'unit' && node.unit) {
              setSelectedUnit(node.unit);
            } else {
              setExpanded(!expanded);
            }
          }}
        >
          <div className="flex items-center gap-3">
            {node.children && node.children.length > 0 && (
              <span className="text-gray-600 dark:text-gray-400">
                {expanded ? '▼' : '▶'}
              </span>
            )}
            <span className={`px-2 py-1 rounded text-xs font-medium ${badge}`}>
              {node.type.toUpperCase()}
            </span>
            <code className="text-sm font-mono text-gray-900 dark:text-white">
              {node.serial}
            </code>
            {childCount > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({childCount} {node.type === 'pallet' ? 'cases' : 'units'})
              </span>
            )}
          </div>
        </div>

        {expanded && node.children && (
          <div className="mt-2">
            {node.children.map((child, i) => (
              <TreeNodeComponent key={i} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
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
              <Link href="/batch" className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300">
                Batch CSV
              </Link>
              <Link href="/hierarchy" className="inline-flex items-center px-1 pt-1 border-b-2 border-blue-500 text-sm font-medium text-gray-900 dark:text-white">
                Hierarchy Tree
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Hierarchy Tree Visualization
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            View the pallet → case → unit hierarchy from your CSV file
          </p>

          {/* File Upload */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 focus:outline-none"
            />
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="text-lg text-gray-600 dark:text-gray-400">Processing CSV...</div>
            </div>
          )}

          {tree.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tree View */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                  Hierarchy Tree
                </h2>
                <div className="overflow-auto max-h-screen">
                  {tree.map((node, i) => (
                    <TreeNodeComponent key={i} node={node} />
                  ))}
                </div>
              </div>

              {/* Selected Unit Details */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                  Selected Unit
                </h2>
                {selectedUnit ? (
                  <div className="space-y-4">
                    <CodeCard
                      bcid={selectedUnit.code.bcid}
                      text={selectedUnit.code.text}
                      appKey={selectedUnit.appKey}
                      symbologyBadge="]d2 GS1"
                    />
                    <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                      <p>
                        <strong>GTIN:</strong> {selectedUnit.gtin}
                      </p>
                      <p>
                        <strong>Serial:</strong> {selectedUnit.serial}
                      </p>
                      <p>
                        <strong>Lot:</strong> {selectedUnit.lot}
                      </p>
                      <p>
                        <strong>Expiry:</strong> {selectedUnit.expiryYYMMDD}
                      </p>
                      <p>
                        <strong>Case:</strong> {selectedUnit.parentSerial}
                      </p>
                      <p>
                        <strong>Pallet:</strong> {selectedUnit.palletSerial}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    Click on a unit in the tree to view details
                  </div>
                )}
              </div>
            </div>
          )}

          {tree.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              Upload a CSV file to visualize the hierarchy
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
