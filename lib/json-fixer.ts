/**
 * Utility functions for parsing and fixing invalid JSON
 * Uses jsonrepair library for robust JSON fixing
 */

import { jsonrepair } from "jsonrepair";

export interface JsonFixResult {
  success: boolean;
  data: unknown;
  formatted: string;
  errors: string[];
  fixes: string[];
}

/**
 * Attempts to parse and fix potentially invalid JSON
 */
export function fixJson(input: string): JsonFixResult {
  const errors: string[] = [];
  const fixes: string[] = [];
  const trimmed = input.trim();

  // Try parsing as-is first
  try {
    const data = JSON.parse(trimmed);
    // Even if valid JSON, recursively parse nested JSON/Python strings
    const processed = recursivelyParseStrings(data);
    const hadNestedParsing = JSON.stringify(processed) !== JSON.stringify(data);

    return {
      success: true,
      data: processed,
      formatted: JSON.stringify(processed, null, 2),
      errors: [],
      fixes: hadNestedParsing ? ["Recursively parsed nested JSON/Python strings"] : [],
    };
  } catch {
    // Continue with fixes
  }

  // Use jsonrepair to fix the JSON
  try {
    const repaired = jsonrepair(trimmed);

    if (repaired !== trimmed) {
      fixes.push("Repaired invalid JSON (fixed quotes, Python syntax, etc.)");
    }

    let data = JSON.parse(repaired);

    // Recursively parse any string values that look like JSON/Python dicts
    const beforeRecursive = JSON.stringify(data);
    data = recursivelyParseStrings(data);
    if (JSON.stringify(data) !== beforeRecursive) {
      fixes.push("Recursively parsed nested JSON/Python strings");
    }

    return {
      success: true,
      data,
      formatted: JSON.stringify(data, null, 2),
      errors: [],
      fixes,
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown parsing error";
    errors.push(errorMessage);
    return {
      success: false,
      data: null,
      formatted: "",
      errors,
      fixes,
    };
  }
}

/**
 * Recursively walk through an object/array and parse any string values
 * that look like JSON or Python dicts
 */
function recursivelyParseStrings(value: unknown, depth: number = 0): unknown {
  // Prevent infinite recursion
  if (depth > 10) return value;

  if (Array.isArray(value)) {
    return value.map((item) => recursivelyParseStrings(item, depth + 1));
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = recursivelyParseStrings(val, depth + 1);
    }
    return result;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    // Check if it looks like a JSON object or array, or Python dict/list
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      const parsed = tryParseWithJsonRepair(trimmed);
      if (parsed !== null) {
        return recursivelyParseStrings(parsed, depth + 1);
      }
    }

    // Check for strings with a prefix before the JSON/Python dict
    // e.g., "extractor_request: {'key': 'value'}"
    const braceIndex = trimmed.indexOf("{");
    const bracketIndex = trimmed.indexOf("[");

    let startIndex = -1;
    let endChar = "";

    if (braceIndex !== -1 && (bracketIndex === -1 || braceIndex < bracketIndex)) {
      startIndex = braceIndex;
      endChar = "}";
    } else if (bracketIndex !== -1) {
      startIndex = bracketIndex;
      endChar = "]";
    }

    // Check if we have a prefix pattern (text followed by : before the brace)
    // e.g., "extractor_request: {'key': 'value'}" -> just parse the dict part
    if (startIndex > 0 && trimmed.endsWith(endChar)) {
      const beforeBrace = trimmed.slice(0, startIndex).trim();
      // Check if the prefix ends with a colon (common pattern like "key: {...}")
      if (beforeBrace.endsWith(":")) {
        const jsonPart = trimmed.slice(startIndex);
        const parsed = tryParseWithJsonRepair(jsonPart);
        if (parsed !== null) {
          // Return just the parsed data, discarding the prefix
          return recursivelyParseStrings(parsed, depth + 1);
        }
      }
    }
  }

  return value;
}

/**
 * Try to parse a string as JSON using jsonrepair
 * Returns the parsed value or null if parsing fails
 */
function tryParseWithJsonRepair(input: string): unknown {
  try {
    // First try standard JSON parse
    return JSON.parse(input);
  } catch {
    // Try with jsonrepair
    try {
      const repaired = jsonrepair(input);
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

/**
 * Minify JSON by removing whitespace
 */
export function minifyJson(input: string): string {
  try {
    const repaired = jsonrepair(input);
    const data = JSON.parse(repaired);
    return JSON.stringify(data);
  } catch {
    return input;
  }
}

/**
 * Format JSON with custom indentation
 */
export function formatJson(input: string, indent: number = 2): string {
  try {
    const repaired = jsonrepair(input);
    const data = JSON.parse(repaired);
    return JSON.stringify(data, null, indent);
  } catch {
    return input;
  }
}
