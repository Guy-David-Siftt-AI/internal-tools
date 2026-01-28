"use client";

import { useState } from "react";

interface JsonOutputProps {
  value: string;
  isValid: boolean;
  errors: string[];
  fixes: string[];
}

export default function JsonOutput({ value, isValid, errors, fixes }: JsonOutputProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Output
          {isValid && value && (
            <span className="ml-2 text-green-600 dark:text-green-400">Valid JSON</span>
          )}
          {!isValid && errors.length > 0 && (
            <span className="ml-2 text-red-600 dark:text-red-400">Invalid JSON</span>
          )}
        </label>
        <button
          onClick={handleCopy}
          disabled={!value || !isValid}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {fixes.length > 0 && (
        <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
            Fixes applied:
          </p>
          <ul className="text-xs text-blue-600 dark:text-blue-400">
            {fixes.map((fix, i) => (
              <li key={i}>• {fix}</li>
            ))}
          </ul>
        </div>
      )}

      {errors.length > 0 && (
        <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">
            Errors:
          </p>
          <ul className="text-xs text-red-600 dark:text-red-400">
            {errors.map((error, i) => (
              <li key={i}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      <pre
        className={`flex-1 w-full p-4 font-mono text-sm rounded-lg overflow-auto ${
          isValid
            ? "bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
            : "bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800"
        }`}
      >
        <code className={isValid ? "text-zinc-800 dark:text-zinc-200" : "text-red-600 dark:text-red-400"}>
          {value || "Formatted JSON will appear here..."}
        </code>
      </pre>
    </div>
  );
}
