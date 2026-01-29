"use client";

import { useState, useCallback } from "react";
import FileUpload from "./FileUpload";
import MappingOutput from "./MappingOutput";

type ActionType = "generate" | "analyze" | "list-fields" | "validate";

interface SheetInfo {
  name: string;
  type: string;
  fieldCount?: number;
  rows?: number;
  columns?: number;
  inputCount?: number;
  formulaCount?: number;
  monthlyPatterns?: number;
}

interface InputCell {
  cell: string;
  value: unknown;
  label: string | null;
  type: string;
}

interface MonthlyPattern {
  row: number;
  label: string | null;
  cells: string[];
}

interface ResultData {
  success: boolean;
  action: string;
  modelName?: string;
  sheetCount?: number;
  sheets?: SheetInfo[];
  mappings?: Record<string, Record<string, unknown>>;
  // For list-fields
  sheetName?: string;
  inputCells?: InputCell[];
  monthlyPatterns?: MonthlyPattern[];
  // For validate
  fieldCount?: number;
  errors?: string[];
  warnings?: string[];
}

interface AvailableSheets {
  names: string[];
  modelName: string;
}

export default function UnderwritingMapper() {
  const [action, setAction] = useState<ActionType>("generate");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMapping, setSelectedMapping] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [validateInput, setValidateInput] = useState("");
  const [availableSheets, setAvailableSheets] = useState<AvailableSheets | null>(null);
  const [useAI, setUseAI] = useState(false);
  const [aiNotes, setAiNotes] = useState("");

  const handleFileUpload = useCallback(
    async (file: File) => {
      setCurrentFile(file);
      setIsProcessing(true);
      setError(null);
      setResult(null);
      setSelectedMapping(null);

      try {
        // For list-fields, first get sheet names
        if (action === "list-fields") {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("action", "analyze");

          const response = await fetch("/api/underwriting-mapper", {
            method: "POST",
            body: formData,
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to analyze file");
          }

          // Store available sheets for selection
          setAvailableSheets({
            names: data.sheets?.map((s: SheetInfo) => s.name) || [],
            modelName: data.modelName,
          });
          setSelectedSheet("");
          setIsProcessing(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("action", action);
        if (useAI) {
          formData.append("useAI", "true");
          if (aiNotes.trim()) {
            formData.append("aiNotes", aiNotes.trim());
          }
        }

        const response = await fetch("/api/underwriting-mapper", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to process file");
        }

        setResult(data);

        // Store available sheets for other actions too
        if (data.sheets) {
          setAvailableSheets({
            names: data.sheets.map((s: SheetInfo) => s.name),
            modelName: data.modelName,
          });
        }

        // Auto-select first mapping for generate action
        if (data.mappings && Object.keys(data.mappings).length > 0) {
          setSelectedMapping(Object.keys(data.mappings)[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsProcessing(false);
      }
    },
    [action, useAI, aiNotes]
  );

  const handleListFields = async (sheetName: string) => {
    if (!currentFile) return;

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", currentFile);
      formData.append("action", "list-fields");
      formData.append("sheet", sheetName);

      const response = await fetch("/api/underwriting-mapper", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to list fields");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleValidate = async () => {
    if (!validateInput.trim()) {
      setError("Please paste a mapping JSON to validate");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const mapping = JSON.parse(validateInput);

      const response = await fetch("/api/underwriting-mapper", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapping }),
      });

      const data = await response.json();
      setResult(data);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError("Invalid JSON format");
      } else {
        setError(err instanceof Error ? err.message : "An error occurred");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    setResult(null);
    setError(null);
    setSelectedMapping(null);
    setCurrentFile(null);
    setValidateInput("");
    setAvailableSheets(null);
    setSelectedSheet("");
  };

  const handleDownload = (key: string, mapping: unknown) => {
    const blob = new Blob([JSON.stringify(mapping, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${key}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    if (!result?.mappings) return;

    for (const [key, mapping] of Object.entries(result.mappings)) {
      handleDownload(key, mapping);
    }
  };

  const getOutputContent = (): Record<string, unknown> | unknown[] | null => {
    if (!result) return null;

    if (result.action === "analyze" && result.sheets) {
      return result.sheets as unknown[];
    }

    if (result.action === "list-fields") {
      return {
        sheetName: result.sheetName,
        inputCells: result.inputCells,
        monthlyPatterns: result.monthlyPatterns,
      };
    }

    if (result.action === "validate") {
      return {
        valid: result.success,
        fieldCount: result.fieldCount,
        errors: result.errors,
        warnings: result.warnings,
      };
    }

    if (selectedMapping && result.mappings) {
      return result.mappings[selectedMapping];
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Action Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-zinc-200 dark:border-zinc-700">
        {(["generate", "analyze", "list-fields", "validate"] as ActionType[]).map(
          (a) => (
            <button
              key={a}
              onClick={() => {
                setAction(a);
                setResult(null);
                setError(null);
                setSelectedSheet("");
                // Keep availableSheets and currentFile for convenience
              }}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                action === a
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              {a === "list-fields"
                ? "List Fields"
                : a.charAt(0).toUpperCase() + a.slice(1)}
            </button>
          )
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={handleClear}
          disabled={!result && !currentFile}
          className="px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear
        </button>

        {action === "generate" && (
          <label className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={useAI}
              onChange={(e) => setUseAI(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-zinc-700 dark:text-zinc-300">Use AI (Gemini)</span>
          </label>
        )}

        {action === "generate" && useAI && (
          <input
            type="text"
            value={aiNotes}
            onChange={(e) => setAiNotes(e.target.value)}
            placeholder="Notes for AI (e.g., 'This is a multifamily model')"
            className="flex-1 min-w-[200px] max-w-[400px] px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-zinc-400"
          />
        )}

        {action === "generate" && result?.mappings && (
          <button
            onClick={handleDownloadAll}
            disabled={Object.keys(result.mappings).length === 0}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Download All
          </button>
        )}

        {action === "validate" && (
          <button
            onClick={handleValidate}
            disabled={!validateInput.trim() || isProcessing}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Validate
          </button>
        )}

        {result && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400 ml-auto">
            {result.action === "generate" &&
              `${result.sheetCount} sheets analyzed, ${result.sheets?.length || 0} mappings generated`}
            {result.action === "analyze" &&
              `${result.sheetCount} sheets found`}
            {result.action === "list-fields" &&
              `${result.inputCells?.length || 0} input fields, ${result.monthlyPatterns?.length || 0} monthly patterns`}
            {result.action === "validate" &&
              (result.success ? "Valid mapping" : "Invalid mapping")}
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        {/* Left panel */}
        <div className="flex flex-col gap-4 overflow-hidden">
          {action === "validate" ? (
            <div className="flex-1 flex flex-col">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Paste mapping JSON to validate:
              </label>
              <textarea
                value={validateInput}
                onChange={(e) => setValidateInput(e.target.value)}
                placeholder='{"sheet_name": "Input", ...}'
                className="flex-1 w-full p-4 font-mono text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <>
              <div className="shrink-0">
                <FileUpload
                  onFileSelect={handleFileUpload}
                  isProcessing={isProcessing}
                />
              </div>

              {error && (
                <div className="shrink-0 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                </div>
              )}

              {/* Sheet selector for list-fields action */}
              {action === "list-fields" && availableSheets && (
                <div className="shrink-0 p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    {result ? "Change sheet:" : "Select a sheet to view fields:"}
                  </label>
                  <select
                    value={selectedSheet}
                    onChange={(e) => setSelectedSheet(e.target.value)}
                    className="w-full p-2 text-sm bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select sheet --</option>
                    {availableSheets.names.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => selectedSheet && handleListFields(selectedSheet)}
                    disabled={!selectedSheet || isProcessing}
                    className="mt-3 w-full px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {result ? "Load Sheet" : "View Fields"}
                  </button>
                </div>
              )}

              {/* Sheet list for analyze action */}
              {action === "analyze" && result?.sheets && (
                <div className="flex-1 min-h-0 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 overflow-y-auto">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
                    Sheets Analysis
                  </h3>
                  <div className="space-y-2">
                    {result.sheets.map((sheet) => (
                      <div
                        key={sheet.name}
                        className="p-3 bg-white dark:bg-zinc-700 rounded-md border border-zinc-200 dark:border-zinc-600"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-zinc-900 dark:text-white">
                            {sheet.name}
                          </span>
                          <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                            {sheet.type}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 grid grid-cols-2 gap-1">
                          <span>Inputs: {sheet.inputCount}</span>
                          <span>Formulas: {sheet.formulaCount}</span>
                          <span>Monthly: {sheet.monthlyPatterns}</span>
                          <span>
                            Size: {sheet.rows}x{sheet.columns}
                          </span>
                        </div>
                        <button
                          onClick={() => handleListFields(sheet.name)}
                          className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          View Fields →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mapping list for generate action */}
              {action === "generate" &&
                result?.mappings &&
                Object.keys(result.mappings).length > 0 && (
                  <div className="flex-1 min-h-0 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 overflow-y-auto">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
                      Generated Mappings
                    </h3>
                    <div className="space-y-2">
                      {Object.keys(result.mappings).map((key) => {
                        const sheet = result.sheets?.find(
                          (s) => {
                            const sanitizedName = s.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
                            return `${result.modelName}_${sanitizedName}_${s.type}` === key;
                          }
                        );
                        return (
                          <div
                            key={key}
                            onClick={() => setSelectedMapping(key)}
                            className={`w-full text-left p-3 rounded-md transition-colors cursor-pointer ${
                              selectedMapping === key
                                ? "bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700"
                                : "bg-white dark:bg-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-600 border border-zinc-200 dark:border-zinc-600"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-zinc-900 dark:text-white">
                                {key}.json
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(key, result.mappings![key]);
                                }}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                Download
                              </button>
                            </div>
                            {sheet && (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                {sheet.name} • {sheet.fieldCount} fields
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
            </>
          )}
        </div>

        {/* Right panel - Output */}
        <div className="lg:col-span-2 h-full">
          <MappingOutput
            mapping={getOutputContent()}
            fileName={
              result?.action === "generate"
                ? selectedMapping || undefined
                : result?.action || undefined
            }
            isValidation={result?.action === "validate"}
            validationResult={
              result?.action === "validate"
                ? {
                    success: result.success,
                    errors: result.errors || [],
                    warnings: result.warnings || [],
                  }
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
