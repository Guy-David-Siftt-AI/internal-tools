"use client";

import { useCallback, useState } from "react";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

export default function FileUpload({
  onFileSelect,
  isProcessing,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && file.name.match(/\.(xlsx|xls)$/i)) {
        setFileName(file.name);
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setFileName(file.name);
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
        isDragging
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10"
          : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500"
      }`}
    >
      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isProcessing}
      />

      <div className="text-center">
        {isProcessing ? (
          <>
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Processing {fileName}...
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
              Excel files (.xlsx, .xls)
            </p>
            {fileName && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                Last: {fileName}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
