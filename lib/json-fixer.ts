/**
 * Utility functions for parsing and fixing invalid JSON
 */

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
  let processed = input.trim();

  // Try parsing as-is first
  try {
    const data = JSON.parse(processed);
    return {
      success: true,
      data,
      formatted: JSON.stringify(data, null, 2),
      errors: [],
      fixes: [],
    };
  } catch {
    // Continue with fixes
  }

  // Apply fixes in sequence
  const originalProcessed = processed;

  // Fix 1: Replace single quotes with double quotes
  processed = fixSingleQuotes(processed);
  if (processed !== originalProcessed) {
    fixes.push("Converted single quotes to double quotes");
  }

  // Fix 2: Add quotes to unquoted keys
  const beforeKeys = processed;
  processed = fixUnquotedKeys(processed);
  if (processed !== beforeKeys) {
    fixes.push("Added quotes to unquoted keys");
  }

  // Fix 3: Fix trailing commas
  const beforeTrailing = processed;
  processed = fixTrailingCommas(processed);
  if (processed !== beforeTrailing) {
    fixes.push("Removed trailing commas");
  }

  // Fix 4: Fix unquoted string values
  const beforeValues = processed;
  processed = fixUnquotedValues(processed);
  if (processed !== beforeValues) {
    fixes.push("Added quotes to unquoted string values");
  }

  // Fix 5: Handle JavaScript-style comments
  const beforeComments = processed;
  processed = removeComments(processed);
  if (processed !== beforeComments) {
    fixes.push("Removed JavaScript comments");
  }

  // Fix 6: Fix missing commas between elements
  const beforeMissingCommas = processed;
  processed = fixMissingCommas(processed);
  if (processed !== beforeMissingCommas) {
    fixes.push("Added missing commas between elements");
  }

  // Try parsing the fixed JSON
  try {
    const data = JSON.parse(processed);
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
 * Replace single quotes with double quotes, being careful about nested quotes
 */
function fixSingleQuotes(input: string): string {
  let result = "";
  let inDoubleQuote = false;
  let inSingleQuote = false;
  let i = 0;

  while (i < input.length) {
    const char = input[i];
    const prevChar = i > 0 ? input[i - 1] : "";

    if (char === '"' && prevChar !== "\\") {
      if (!inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
      }
      result += char;
    } else if (char === "'" && prevChar !== "\\") {
      if (!inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        result += '"';
      } else {
        result += char;
      }
    } else {
      result += char;
    }
    i++;
  }

  return result;
}

/**
 * Add quotes to unquoted object keys
 */
function fixUnquotedKeys(input: string): string {
  // Match unquoted keys followed by a colon
  // This regex looks for word characters (and some special chars) that aren't quoted
  return input.replace(
    /([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g,
    '$1"$2"$3'
  );
}

/**
 * Remove trailing commas before closing brackets
 */
function fixTrailingCommas(input: string): string {
  // Remove trailing commas before } or ]
  return input
    .replace(/,(\s*})/g, "$1")
    .replace(/,(\s*\])/g, "$1");
}

/**
 * Fix unquoted string values (basic cases)
 */
function fixUnquotedValues(input: string): string {
  // This is tricky - we need to identify unquoted values that should be strings
  // Match patterns like: "key": value where value is not a number, boolean, null, or already quoted
  return input.replace(
    /(:\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*[,}\]])/g,
    (match, prefix, value, suffix) => {
      // Don't quote known JSON values
      if (["true", "false", "null"].includes(value)) {
        return match;
      }
      return `${prefix}"${value}"${suffix}`;
    }
  );
}

/**
 * Remove JavaScript-style comments
 */
function removeComments(input: string): string {
  // Remove single-line comments
  let result = input.replace(/\/\/.*$/gm, "");
  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, "");
  return result;
}

/**
 * Fix missing commas between array elements or object properties
 */
function fixMissingCommas(input: string): string {
  // Fix missing commas between strings: "value1" "value2" -> "value1", "value2"
  let result = input.replace(/(")\s*\n\s*(")/g, '$1,\n$2');
  // Fix missing commas between closing and opening braces/brackets
  result = result.replace(/(})\s*\n\s*({)/g, '$1,\n$2');
  result = result.replace(/(\])\s*\n\s*(\[)/g, '$1,\n$2');
  result = result.replace(/(})\s*\n\s*(")/g, '$1,\n$2');
  result = result.replace(/(")\s*\n\s*({)/g, '$1,\n$2');
  return result;
}

/**
 * Minify JSON by removing whitespace
 */
export function minifyJson(input: string): string {
  try {
    const data = JSON.parse(input);
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
    const data = JSON.parse(input);
    return JSON.stringify(data, null, indent);
  } catch {
    return input;
  }
}
