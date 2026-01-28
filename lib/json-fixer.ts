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

  // Fix 1: Replace Python literals (None, True, False)
  const beforePython = processed;
  processed = fixPythonLiterals(processed);
  if (processed !== beforePython) {
    fixes.push("Converted Python literals (None/True/False) to JSON");
  }

  // Fix 2: Replace single quotes with double quotes (smart handling)
  const beforeQuotes = processed;
  processed = fixSingleQuotes(processed);
  if (processed !== beforeQuotes) {
    fixes.push("Converted single quotes to double quotes");
  }

  // Fix 3: Add quotes to unquoted keys
  const beforeKeys = processed;
  processed = fixUnquotedKeys(processed);
  if (processed !== beforeKeys) {
    fixes.push("Added quotes to unquoted keys");
  }

  // Fix 4: Fix trailing commas
  const beforeTrailing = processed;
  processed = fixTrailingCommas(processed);
  if (processed !== beforeTrailing) {
    fixes.push("Removed trailing commas");
  }

  // Fix 5: Fix unquoted string values
  const beforeValues = processed;
  processed = fixUnquotedValues(processed);
  if (processed !== beforeValues) {
    fixes.push("Added quotes to unquoted string values");
  }

  // Fix 6: Handle JavaScript-style comments
  const beforeComments = processed;
  processed = removeComments(processed);
  if (processed !== beforeComments) {
    fixes.push("Removed JavaScript comments");
  }

  // Fix 7: Fix missing commas between elements
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
 * Replace Python literals with JSON equivalents
 */
function fixPythonLiterals(input: string): string {
  let result = input;

  // Replace None with null (word boundary to avoid replacing inside strings)
  result = result.replace(/\bNone\b/g, "null");

  // Replace True with true
  result = result.replace(/\bTrue\b/g, "true");

  // Replace False with false
  result = result.replace(/\bFalse\b/g, "false");

  return result;
}

/**
 * Replace single quotes with double quotes, handling apostrophes inside strings
 */
function fixSingleQuotes(input: string): string {
  const result: string[] = [];
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    // Check if this is a single-quoted string
    if (char === "'") {
      // Find the end of this single-quoted string
      let stringContent = "";
      i++; // Skip opening quote

      while (i < input.length) {
        const c = input[i];

        // Handle escaped characters
        if (c === "\\" && i + 1 < input.length) {
          stringContent += c + input[i + 1];
          i += 2;
          continue;
        }

        // Check for closing quote
        // A single quote followed by certain characters is likely a closing quote
        if (c === "'") {
          const nextChar = input[i + 1] || "";
          const isClosingQuote = /[\s,\]\}:]/.test(nextChar) || i + 1 >= input.length;

          if (isClosingQuote) {
            break; // End of string
          } else {
            // This is likely an apostrophe inside the string
            stringContent += c;
            i++;
            continue;
          }
        }

        stringContent += c;
        i++;
      }

      // Escape any double quotes inside the content and wrap with double quotes
      const escapedContent = stringContent.replace(/"/g, '\\"');
      result.push('"' + escapedContent + '"');
      i++; // Skip closing quote
    } else {
      result.push(char);
      i++;
    }
  }

  return result.join("");
}

/**
 * Add quotes to unquoted object keys
 */
function fixUnquotedKeys(input: string): string {
  // Match unquoted keys followed by a colon
  return input.replace(
    /([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g,
    '$1"$2"$3'
  );
}

/**
 * Remove trailing commas before closing brackets
 */
function fixTrailingCommas(input: string): string {
  return input
    .replace(/,(\s*})/g, "$1")
    .replace(/,(\s*\])/g, "$1");
}

/**
 * Fix unquoted string values (basic cases)
 */
function fixUnquotedValues(input: string): string {
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
  let result = input.replace(/(")\s*\n\s*(")/g, '$1,\n$2');
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
