"use client";

import { useState } from "react";

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

interface MappingOutputProps {
  mapping: Record<string, unknown> | unknown[] | null;
  fileName?: string;
  isValidation?: boolean;
  validationResult?: ValidationResult;
}

export default function MappingOutput({
  mapping,
  fileName,
  isValidation,
  validationResult,
}: MappingOutputProps) {
  const [copied, setCopied] = useState(false);

  const formattedJson = mapping ? JSON.stringify(mapping, null, 2) : "";

  const handleCopy = async () => {
    if (!formattedJson) return;

    await navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          {fileName ? `${fileName}.json` : "Output"}
        </h3>
        {mapping && (
          <button
            onClick={handleCopy}
            className="px-3 py-1 text-xs bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        )}
      </div>

      {/* Validation Results */}
      {isValidation && validationResult && (
        <div className="mb-4 space-y-2">
          <div
            className={`p-3 rounded-lg ${
              validationResult.success
                ? "bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800"
            }`}
          >
            <p
              className={`text-sm font-medium ${
                validationResult.success
                  ? "text-green-700 dark:text-green-400"
                  : "text-red-700 dark:text-red-400"
              }`}
            >
              {validationResult.success
                ? "Validation Passed"
                : "Validation Failed"}
            </p>
          </div>

          {validationResult.errors.length > 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                Errors:
              </p>
              <ul className="text-sm text-red-600 dark:text-red-400 list-disc list-inside space-y-1">
                {validationResult.errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {validationResult.warnings.length > 0 && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-2">
                Warnings:
              </p>
              <ul className="text-sm text-yellow-600 dark:text-yellow-400 list-disc list-inside space-y-1">
                {validationResult.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 relative min-h-0">
        <pre
          className={`absolute inset-0 w-full h-full p-4 font-mono text-sm rounded-lg overflow-auto ${
            mapping
              ? "bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
              : "bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700"
          }`}
        >
          <code className="text-zinc-800 dark:text-zinc-200">
            {formattedJson || "Upload an Excel file to generate mappings..."}
          </code>
        </pre>
      </div>
    </div>
  );
}
