"use client";

import { useState, useEffect } from "react";
import JsonInput from "./JsonInput";
import JsonOutput from "./JsonOutput";
import { fixJson, minifyJson, formatJson } from "@/lib/json-fixer";

export default function JsonFormatter() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [isValid, setIsValid] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [fixes, setFixes] = useState<string[]>([]);
  const [isMinified, setIsMinified] = useState(false);

  useEffect(() => {
    if (!input.trim()) {
      setOutput("");
      setIsValid(true);
      setErrors([]);
      setFixes([]);
      return;
    }

    const result = fixJson(input);
    setIsValid(result.success);
    setErrors(result.errors);
    setFixes(result.fixes);

    if (result.success) {
      setOutput(isMinified ? minifyJson(result.formatted) : result.formatted);
    } else {
      setOutput("");
    }
  }, [input, isMinified]);

  const handleClear = () => {
    setInput("");
    setOutput("");
    setIsValid(true);
    setErrors([]);
    setFixes([]);
  };

  const toggleMinify = () => {
    if (!output) return;
    setIsMinified(!isMinified);
  };

  const handleFormatWithIndent = (indent: number) => {
    if (!output) return;
    setIsMinified(false);
    try {
      const data = JSON.parse(output);
      setOutput(JSON.stringify(data, null, indent));
    } catch {
      // If current output is invalid, try from the fixed result
      const result = fixJson(input);
      if (result.success) {
        setOutput(formatJson(result.formatted, indent));
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-sm text-zinc-500 dark:text-zinc-400 mr-2">
          Format:
        </span>
        <button
          onClick={() => handleFormatWithIndent(2)}
          disabled={!isValid || !output}
          className="px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          2 spaces
        </button>
        <button
          onClick={() => handleFormatWithIndent(4)}
          disabled={!isValid || !output}
          className="px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          4 spaces
        </button>
        <button
          onClick={toggleMinify}
          disabled={!isValid || !output}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isMinified
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          }`}
        >
          Minify
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
        <JsonInput value={input} onChange={setInput} onClear={handleClear} />
        <JsonOutput
          value={output}
          isValid={isValid}
          errors={errors}
          fixes={fixes}
        />
      </div>
    </div>
  );
}
