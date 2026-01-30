"use client";

import { useCallback, useState, useEffect } from "react";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
  useAI?: boolean;
  hasResult?: boolean;  // indicates extraction completed
  currentFile?: File | null;  // file from parent to persist across tabs
}

export default function FileUpload({
  onFileSelect,
  isProcessing,
  useAI = false,
  hasResult = false,
  currentFile = null,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(currentFile);
  const [isExtractPending, setIsExtractPending] = useState(false);

  // Sync selectedFile when currentFile prop changes (e.g., when switching tabs)
  useEffect(() => {
    setSelectedFile(currentFile);
  }, [currentFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.name.match(/\.(xlsx|xlsm|xls)$/i)) {
      setSelectedFile(file);
    }
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setSelectedFile(file);
      }
    },
    []
  );

  const handleExtract = useCallback(() => {
    if (selectedFile && !isExtractPending) {
      setIsExtractPending(true);
      onFileSelect(selectedFile);
    }
  }, [selectedFile, onFileSelect, isExtractPending]);

  // Reset extract pending state when processing completes
  useEffect(() => {
    if (!isProcessing) {
      setIsExtractPending(false);
    }
  }, [isProcessing]);

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
  }, []);

  return (
    <div className="space-y-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10"
            : selectedFile
            ? "border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/10"
            : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500"
        }`}
      >
        <input
          type="file"
          accept=".xlsx,.xlsm,.xls"
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isProcessing}
        />

        <div className="text-center">
          {isProcessing ? (
            <>
              {useAI ? (
                <>
                  <div className="relative h-10 w-10 mx-auto mb-3">
                    <div className="absolute inset-0 animate-spin rounded-full border-2 border-purple-600 border-t-transparent"></div>
                    <div className="absolute inset-1 animate-spin rounded-full border-2 border-purple-400 border-b-transparent" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
                    <svg
                      className="absolute inset-0 w-full h-full p-2 text-purple-600"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a2 2 0 110 4h-1a7 7 0 01-7 7h-2a7 7 0 01-7-7H4a2 2 0 110-4h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zm0 9a3 3 0 100 6 3 3 0 000-6z"/>
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                    AI is extracting fields...
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Analyzing {selectedFile?.name} with Gemini
                  </p>
                </>
              ) : (
                <>
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Processing {selectedFile?.name}...
                  </p>
                </>
              )}
            </>
          ) : selectedFile ? (
            <>
              <svg
                className="w-10 h-10 mx-auto mb-3 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                {selectedFile.name}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {(selectedFile.size / 1024).toFixed(1)} KB • Click to change file
              </p>
            </>
          ) : (
            <>
              <svg
                className="w-10 h-10 mx-auto mb-3 text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  Click to upload
                </span>{" "}
                or drag and drop
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                Excel files (.xlsx, .xlsm, .xls)
              </p>
            </>
          )}
        </div>
      </div>

      {selectedFile && !isProcessing && (
        <div className="flex gap-2">
          {hasResult ? (
            <button
              onClick={handleExtract}
              disabled={isExtractPending}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Extracted
            </button>
          ) : (
            <button
              onClick={handleExtract}
              disabled={isExtractPending}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExtractPending ? "Extracting..." : "Extract"}
            </button>
          )}
          <button
            onClick={handleClearFile}
            className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
