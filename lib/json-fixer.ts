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

  // Fix 1: Handle JavaScript-style comments first (before quote processing)
  const beforeComments = processed;
  processed = removeComments(processed);
  if (processed !== beforeComments) {
    fixes.push("Removed JavaScript comments");
  }

  // Fix 2: Convert quotes (handles mixed single/double quotes and apostrophes)
  const beforeQuotes = processed;
  processed = fixQuotes(processed);
  if (processed !== beforeQuotes) {
    fixes.push("Fixed quote formatting");
  }

  // Fix 3: Replace Python literals (None, True, False) - AFTER quote conversion
  const beforePython = processed;
  processed = fixPythonLiterals(processed);
  if (processed !== beforePython) {
    fixes.push("Converted Python literals (None/True/False) to JSON");
  }

  // Fix 4: Add quotes to unquoted keys
  const beforeKeys = processed;
  processed = fixUnquotedKeys(processed);
  if (processed !== beforeKeys) {
    fixes.push("Added quotes to unquoted keys");
  }

  // Fix 5: Fix trailing commas
  const beforeTrailing = processed;
  processed = fixTrailingCommas(processed);
  if (processed !== beforeTrailing) {
    fixes.push("Removed trailing commas");
  }

  // Fix 6: Fix unquoted string values
  const beforeValues = processed;
  processed = fixUnquotedValues(processed);
  if (processed !== beforeValues) {
    fixes.push("Added quotes to unquoted string values");
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
 * Fix quotes - handles mixed single/double quotes and apostrophes in strings
 */
function fixQuotes(input: string): string {
  const result: string[] = [];
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    // Handle double-quoted strings (pass through as-is)
    if (char === '"') {
      result.push(char);
      i++;
      // Read until closing double quote
      while (i < input.length) {
        const c = input[i];
        if (c === '\\' && i + 1 < input.length) {
          // Escaped character - push both
          result.push(c, input[i + 1]);
          i += 2;
        } else if (c === '"') {
          result.push(c);
          i++;
          break;
        } else {
          result.push(c);
          i++;
        }
      }
      continue;
    }

    // Handle single-quoted strings (convert to double quotes)
    if (char === "'") {
      // Collect the string content
      let stringContent = "";
      i++; // Skip opening quote

      while (i < input.length) {
        const c = input[i];

        // Handle escaped characters
        if (c === '\\' && i + 1 < input.length) {
          const nextChar = input[i + 1];
          if (nextChar === "'") {
            // Escaped single quote -> just add the quote
            stringContent += "'";
            i += 2;
          } else {
            stringContent += c + nextChar;
            i += 2;
          }
          continue;
        }

        // Check for closing quote
        if (c === "'") {
          // Look ahead to determine if this is a closing quote or an apostrophe
          const nextChar = input[i + 1] || "";

          // It's a closing quote if followed by structural characters or end of input
          const isClosingQuote = /^[\s,\]\}:\[]/.test(nextChar) || i + 1 >= input.length;

          if (isClosingQuote) {
            i++; // Skip closing quote
            break;
          } else {
            // It's an apostrophe inside the string
            stringContent += c;
            i++;
            continue;
          }
        }

        stringContent += c;
        i++;
      }

      // Escape any double quotes and backslashes inside the content
      const escapedContent = stringContent
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');

      result.push('"' + escapedContent + '"');
      continue;
    }

    // Any other character - pass through
    result.push(char);
    i++;
  }

  return result.join("");
}

/**
 * Replace Python literals with JSON equivalents
 * Only replaces when they appear as values (not inside strings)
 */
function fixPythonLiterals(input: string): string {
  // Since we've already converted to proper double-quoted strings,
  // we can safely replace Python literals that appear outside of strings

  let result = "";
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    // Skip over double-quoted strings
    if (char === '"') {
      result += char;
      i++;
      while (i < input.length) {
        const c = input[i];
        result += c;
        if (c === '\\' && i + 1 < input.length) {
          result += input[i + 1];
          i += 2;
        } else if (c === '"') {
          i++;
          break;
        } else {
          i++;
        }
      }
      continue;
    }

    // Check for Python literals
    const remaining = input.slice(i);

    if (remaining.match(/^None(?![a-zA-Z0-9_])/)) {
      result += "null";
      i += 4;
      continue;
    }

    if (remaining.match(/^True(?![a-zA-Z0-9_])/)) {
      result += "true";
      i += 4;
      continue;
    }

    if (remaining.match(/^False(?![a-zA-Z0-9_])/)) {
      result += "false";
      i += 5;
      continue;
    }

    result += char;
    i++;
  }

  return result;
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
  let result = "";
  let i = 0;

  while (i < input.length) {
    // Skip strings
    if (input[i] === '"' || input[i] === "'") {
      const quote = input[i];
      result += input[i];
      i++;
      while (i < input.length) {
        if (input[i] === '\\' && i + 1 < input.length) {
          result += input[i] + input[i + 1];
          i += 2;
        } else if (input[i] === quote) {
          result += input[i];
          i++;
          break;
        } else {
          result += input[i];
          i++;
        }
      }
      continue;
    }

    // Check for comments
    if (input[i] === '/' && i + 1 < input.length) {
      if (input[i + 1] === '/') {
        // Single-line comment - skip until newline
        i += 2;
        while (i < input.length && input[i] !== '\n') {
          i++;
        }
        continue;
      } else if (input[i + 1] === '*') {
        // Multi-line comment - skip until */
        i += 2;
        while (i < input.length - 1) {
          if (input[i] === '*' && input[i + 1] === '/') {
            i += 2;
            break;
          }
          i++;
        }
        continue;
      }
    }

    result += input[i];
    i++;
  }

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
