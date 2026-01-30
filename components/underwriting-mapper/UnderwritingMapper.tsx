"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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

interface HistoryItem {
  id: string;
  fileName: string;
  timestamp: Date;
  action: ActionType;
  result: ResultData;
  selectedMapping: string | null;
}

interface AvailableSheets {
  names: string[];
  modelName: string;
}

export default function UnderwritingMapper() {
  const [action, setAction] = useState<ActionType>("generate");
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultsByAction, setResultsByAction] = useState<Partial<Record<ActionType, ResultData | null>>>({});
  const [error, setError] = useState<string | null>(null);
  const [selectedMappingByAction, setSelectedMappingByAction] = useState<Partial<Record<ActionType, string | null>>>({});
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [validateInput, setValidateInput] = useState("");
  const [availableSheetsByAction, setAvailableSheetsByAction] = useState<Partial<Record<ActionType, AvailableSheets | null>>>({});
  const [useAI, setUseAI] = useState(false);
  const [aiNotes, setAiNotes] = useState("");
  const [aiModel, setAiModel] = useState("gemini-2.0-flash");
  const [uploadKey, setUploadKey] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Derived values for current action
  const result = resultsByAction[action] ?? null;
  const selectedMapping = selectedMappingByAction[action] ?? null;
  const availableSheets = availableSheetsByAction[action] ?? null;

  // Setters for current action
  const setResult = (data: ResultData | null) => {
    setResultsByAction(prev => ({ ...prev, [action]: data }));
  };
  const setSelectedMapping = (mapping: string | null) => {
    setSelectedMappingByAction(prev => ({ ...prev, [action]: mapping }));
  };
  const setAvailableSheets = (sheets: AvailableSheets | null) => {
    setAvailableSheetsByAction(prev => ({ ...prev, [action]: sheets }));
  };

  // Refs to avoid stale closures in handleFileUpload
  const resultRef = useRef<ResultData | null>(null);
  const currentFileRef = useRef<File | null>(null);
  const selectedMappingRef = useRef<string | null>(null);
  const actionRef = useRef<ActionType>(action);

  const availableModels = [
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    { value: "gemini-1.5-flash-8b", label: "Gemini 1.5 Flash 8B" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-3-flash-preview", label: "Gemini 3.0 Flash" },
  ];

  // Sync refs with state for use in callbacks
  useEffect(() => { resultRef.current = resultsByAction[actionRef.current] ?? null; }, [resultsByAction]);
  useEffect(() => { currentFileRef.current = currentFile; }, [currentFile]);
  useEffect(() => { selectedMappingRef.current = selectedMappingByAction[actionRef.current] ?? null; }, [selectedMappingByAction]);
  useEffect(() => { actionRef.current = action; }, [action]);

  // Clear viewingHistoryId if the history item no longer exists
  useEffect(() => {
    if (viewingHistoryId && !history.find(h => h.id === viewingHistoryId)) {
      setViewingHistoryId(null);
    }
  }, [viewingHistoryId, history]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      // Cancel any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      // Save current extraction to history before clearing (use refs to avoid stale closures)
      if (resultRef.current && currentFileRef.current) {
        const historyItem: HistoryItem = {
          id: Date.now().toString(),
          fileName: currentFileRef.current.name,
          timestamp: new Date(),
          action: resultRef.current.action as ActionType,
          result: resultRef.current,
          selectedMapping: selectedMappingRef.current,
        };
        setHistory(prev => [historyItem, ...prev].slice(0, 10)); // Keep max 10
      }
      setViewingHistoryId(null);

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
            signal,
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
          formData.append("aiModel", aiModel);
          if (aiNotes.trim()) {
            formData.append("aiNotes", aiNotes.trim());
          }
        }

        const response = await fetch("/api/underwriting-mapper", {
          method: "POST",
          body: formData,
          signal,
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
        if (err instanceof Error && err.name === "AbortError") {
          setError("Request cancelled");
        } else {
          setError(err instanceof Error ? err.message : "An error occurred");
        }
      } finally {
        setIsProcessing(false);
        abortControllerRef.current = null;
      }
    },
    [action, useAI, aiNotes, aiModel]
  );

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setError("Request cancelled");
  }, []);

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
    setResultsByAction(prev => ({ ...prev, [action]: null }));
    setSelectedMappingByAction(prev => ({ ...prev, [action]: null }));
    setAvailableSheetsByAction(prev => ({ ...prev, [action]: null }));
    setError(null);
    setCurrentFile(null);
    setValidateInput("");
    setSelectedSheet("");
    setViewingHistoryId(null);
    setUploadKey(prev => prev + 1); // Force FileUpload to re-render and reset file input
  };

  // Compute active result and selected mapping based on whether viewing history
  const viewingHistoryItem = viewingHistoryId ? history.find(h => h.id === viewingHistoryId) : null;
  const activeResult = viewingHistoryItem?.result || result;
  const activeSelectedMapping = viewingHistoryItem?.selectedMapping ?? selectedMapping;

  // Filter history by current action
  const filteredHistory = history.filter(h => h.action === action);

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
    const targetResult = viewingHistoryItem?.result || result;
    if (!targetResult?.mappings) return;

    for (const [key, mapping] of Object.entries(targetResult.mappings)) {
      handleDownload(key, mapping);
    }
  };

  const handleSelectHistoryItem = (historyId: string) => {
    setViewingHistoryId(historyId);
  };

  const handleBackToCurrent = () => {
    setViewingHistoryId(null);
  };

  const handleDeleteHistoryItem = (historyId: string) => {
    setHistory(prev => prev.filter(h => h.id !== historyId));
    if (viewingHistoryId === historyId) {
      setViewingHistoryId(null);
    }
  };

  const handleHistoryMappingSelect = (historyId: string, mappingKey: string) => {
    setHistory(prev => prev.map(h =>
      h.id === historyId ? { ...h, selectedMapping: mappingKey } : h
    ));
  };

  const getOutputContent = (): Record<string, unknown> | unknown[] | null => {
    if (!activeResult) return null;

    if (activeResult.action === "analyze" && activeResult.sheets) {
      return activeResult.sheets as unknown[];
    }

    if (activeResult.action === "list-fields") {
      return {
        sheetName: activeResult.sheetName,
        inputCells: activeResult.inputCells,
        monthlyPatterns: activeResult.monthlyPatterns,
      };
    }

    if (activeResult.action === "validate") {
      return {
        valid: activeResult.success,
        fieldCount: activeResult.fieldCount,
        errors: activeResult.errors,
        warnings: activeResult.warnings,
      };
    }

    if (activeSelectedMapping && activeResult.mappings) {
      return activeResult.mappings[activeSelectedMapping];
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
                if (isProcessing) return; // Block during processing
                setAction(a);
                setError(null);
                setSelectedSheet("");
                setViewingHistoryId(null);
                // Results, mappings, and sheets are now stored per-action, so no need to clear them
              }}
              disabled={isProcessing}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                action === a
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : isProcessing
                    ? "border-transparent text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
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

        {isProcessing && (
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 text-sm bg-red-600 text-white hover:bg-red-700 rounded-md transition-colors"
          >
            Cancel
          </button>
        )}

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
          <select
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            className="px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {availableModels.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
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

        {action === "generate" && activeResult?.mappings && (
          <button
            onClick={handleDownloadAll}
            disabled={Object.keys(activeResult.mappings).length === 0}
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

        {activeResult && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400 ml-auto">
            {viewingHistoryId && <span className="text-amber-600 dark:text-amber-400 mr-2">[History]</span>}
            {activeResult.action === "generate" &&
              `${activeResult.sheetCount} sheets analyzed, ${activeResult.sheets?.length || 0} mappings generated`}
            {activeResult.action === "analyze" &&
              `${activeResult.sheetCount} sheets found`}
            {activeResult.action === "list-fields" &&
              `${activeResult.inputCells?.length || 0} input fields, ${activeResult.monthlyPatterns?.length || 0} monthly patterns`}
            {activeResult.action === "validate" &&
              (activeResult.success ? "Valid mapping" : "Invalid mapping")}
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
                  key={uploadKey}
                  onFileSelect={handleFileUpload}
                  isProcessing={isProcessing}
                  useAI={action === "generate" && useAI}
                  hasResult={!!result}
                  currentFile={currentFile}
                />
              </div>

              {/* History Section - filtered by current action */}
              {filteredHistory.length > 0 && (
                <div className="shrink-0 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-700">
                    <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      Previous Extractions ({filteredHistory.length})
                    </h3>
                    <button
                      onClick={() => setHistory(prev => prev.filter(h => h.action !== action))}
                      className="text-xs text-zinc-500 hover:text-red-500"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {filteredHistory.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectHistoryItem(item.id)}
                        className={`flex items-center justify-between p-3 cursor-pointer ${
                          viewingHistoryId === item.id
                            ? "bg-amber-100 dark:bg-amber-900/30 border-l-2 border-amber-500"
                            : "hover:bg-zinc-100 dark:hover:bg-zinc-700"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-zinc-900 dark:text-white">
                            {item.fileName}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteHistoryItem(item.id);
                          }}
                          className="ml-2 p-1 text-zinc-400 hover:text-red-500"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Back to Current Button */}
              {viewingHistoryId && (result || isProcessing || currentFile) && (
                <button
                  onClick={handleBackToCurrent}
                  className="shrink-0 w-full p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg"
                >
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    ← {isProcessing
                      ? `Processing: ${currentFile?.name}...`
                      : result
                        ? "Back to Current Result"
                        : `Back to: ${currentFile?.name}`}
                  </span>
                </button>
              )}

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
              {activeResult?.action === "analyze" && activeResult?.sheets && (
                <div className="flex-1 min-h-0 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 overflow-y-auto">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
                    {viewingHistoryId ? "Historical Sheets Analysis" : "Sheets Analysis"}
                  </h3>
                  <div className="space-y-2">
                    {activeResult.sheets.map((sheet) => (
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
                        {!viewingHistoryId && (
                          <button
                            onClick={() => handleListFields(sheet.name)}
                            className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            View Fields →
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mapping list for generate action */}
              {activeResult?.action === "generate" &&
                activeResult?.mappings &&
                Object.keys(activeResult.mappings).length > 0 && (
                  <div className="flex-1 min-h-0 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 overflow-y-auto">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
                      {viewingHistoryId ? "Historical Mappings" : "Generated Mappings"}
                    </h3>
                    <div className="space-y-2">
                      {Object.keys(activeResult.mappings).map((key) => {
                        const sheet = activeResult.sheets?.find(
                          (s) => {
                            const sanitizedName = s.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
                            return `${activeResult.modelName}_${sanitizedName}_${s.type}` === key;
                          }
                        );
                        return (
                          <div
                            key={key}
                            onClick={() => {
                              if (viewingHistoryId) {
                                handleHistoryMappingSelect(viewingHistoryId, key);
                              } else {
                                setSelectedMapping(key);
                              }
                            }}
                            className={`w-full text-left p-3 rounded-md transition-colors cursor-pointer ${
                              activeSelectedMapping === key
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
                                  handleDownload(key, activeResult.mappings![key]);
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
              activeResult?.action === "generate"
                ? activeSelectedMapping || undefined
                : activeResult?.action || undefined
            }
            isValidation={activeResult?.action === "validate"}
            validationResult={
              activeResult?.action === "validate"
                ? {
                    success: activeResult.success,
                    errors: activeResult.errors || [],
                    warnings: activeResult.warnings || [],
                  }
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
