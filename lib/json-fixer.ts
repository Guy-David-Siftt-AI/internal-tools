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

  // Fix 1: Remove comments first
  const beforeComments = processed;
  processed = removeComments(processed);
  if (processed !== beforeComments) {
    fixes.push("Removed JavaScript comments");
  }

  // Fix 2: Convert Python dict to JSON using a safe approach
  const beforePython = processed;
  processed = convertPythonToJson(processed);
  if (processed !== beforePython) {
    fixes.push("Converted Python dict syntax to JSON");
  }

  // Fix 3: Fix trailing commas
  const beforeTrailing = processed;
  processed = fixTrailingCommas(processed);
  if (processed !== beforeTrailing) {
    fixes.push("Removed trailing commas");
  }

  // Fix 4: Add quotes to unquoted keys
  const beforeKeys = processed;
  processed = fixUnquotedKeys(processed);
  if (processed !== beforeKeys) {
    fixes.push("Added quotes to unquoted keys");
  }

  // Try parsing the fixed JSON
  try {
    let data = JSON.parse(processed);

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
      const parsed = tryParseJsonOrPython(trimmed);
      if (parsed !== null) {
        return recursivelyParseStrings(parsed, depth + 1);
      }
    }

    // Check for strings with a prefix before the JSON/Python dict
    // e.g., "extractor_request: {'key': 'value'}"
    const prefixMatch = trimmed.match(/^([^{[]+?):\s*(\{[\s\S]*\}|\[[\s\S]*\])$/);
    if (prefixMatch) {
      const prefix = prefixMatch[1].trim();
      const jsonPart = prefixMatch[2];
      const parsed = tryParseJsonOrPython(jsonPart);
      if (parsed !== null) {
        return {
          _prefix: prefix,
          _data: recursivelyParseStrings(parsed, depth + 1),
        };
      }
    }
  }

  return value;
}

/**
 * Try to parse a string as JSON or Python dict
 * Returns the parsed value or null if parsing fails
 */
function tryParseJsonOrPython(input: string): unknown {
  // First try standard JSON parse
  try {
    return JSON.parse(input);
  } catch {
    // Try fixing it as Python dict
    try {
      const fixed = convertPythonToJson(input);
      const fixedTrailing = fixTrailingCommas(fixed);
      return JSON.parse(fixedTrailing);
    } catch {
      return null;
    }
  }
}

/**
 * Convert Python dict syntax to JSON
 * Handles: single quotes, None, True, False
 */
function convertPythonToJson(input: string): string {
  // We'll process the string, keeping track of whether we're in a string
  const result: string[] = [];
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    // Handle double-quoted strings (JSON-style) - pass through unchanged
    if (char === '"') {
      const [str, newIndex] = readDoubleQuotedString(input, i);
      result.push(str);
      i = newIndex;
      continue;
    }

    // Handle single-quoted strings (Python-style) - convert to double quotes
    if (char === "'") {
      const [str, newIndex] = readSingleQuotedString(input, i);
      result.push(str);
      i = newIndex;
      continue;
    }

    // Handle Python literals (None, True, False) outside of strings
    const remaining = input.slice(i);

    const noneMatch = remaining.match(/^None(?![a-zA-Z0-9_])/);
    if (noneMatch) {
      result.push("null");
      i += 4;
      continue;
    }

    const trueMatch = remaining.match(/^True(?![a-zA-Z0-9_])/);
    if (trueMatch) {
      result.push("true");
      i += 4;
      continue;
    }

    const falseMatch = remaining.match(/^False(?![a-zA-Z0-9_])/);
    if (falseMatch) {
      result.push("false");
      i += 5;
      continue;
    }

    // Pass through any other character
    result.push(char);
    i++;
  }

  return result.join("");
}

/**
 * Read a double-quoted string starting at position i
 * Returns the string (unchanged) and the new position after the string
 */
function readDoubleQuotedString(input: string, start: number): [string, number] {
  let i = start + 1; // Skip opening quote
  let result = '"';

  while (i < input.length) {
    const c = input[i];

    if (c === "\\") {
      // Escape sequence - include both characters
      if (i + 1 < input.length) {
        result += c + input[i + 1];
        i += 2;
      } else {
        result += c;
        i++;
      }
    } else if (c === '"') {
      // Closing quote
      result += c;
      i++;
      break;
    } else {
      result += c;
      i++;
    }
  }

  return [result, i];
}

/**
 * Read a single-quoted string starting at position i
 * Returns a JSON-compatible double-quoted string and the new position
 */
function readSingleQuotedString(input: string, start: number): [string, number] {
  let i = start + 1; // Skip opening quote
  let content = "";

  while (i < input.length) {
    const c = input[i];

    if (c === "\\") {
      // Escape sequence
      if (i + 1 < input.length) {
        const nextChar = input[i + 1];
        if (nextChar === "'") {
          // Escaped single quote -> literal single quote
          content += "'";
        } else if (nextChar === '"') {
          // Escaped double quote -> literal double quote
          content += '"';
        } else if (nextChar === "\\") {
          // Escaped backslash -> single backslash
          content += "\\";
        } else if (nextChar === "n") {
          content += "\n";
        } else if (nextChar === "t") {
          content += "\t";
        } else if (nextChar === "r") {
          content += "\r";
        } else if (nextChar === "b") {
          content += "\b";
        } else if (nextChar === "f") {
          content += "\f";
        } else if (nextChar === "x" && i + 3 < input.length) {
          // Hex escape \xNN
          const hex = input.slice(i + 2, i + 4);
          const charCode = parseInt(hex, 16);
          if (!isNaN(charCode)) {
            content += String.fromCharCode(charCode);
            i += 4;
            continue;
          }
          content += nextChar;
        } else if (nextChar === "u" && i + 5 < input.length) {
          // Unicode escape \uNNNN
          const hex = input.slice(i + 2, i + 6);
          const charCode = parseInt(hex, 16);
          if (!isNaN(charCode)) {
            content += String.fromCharCode(charCode);
            i += 6;
            continue;
          }
          content += nextChar;
        } else {
          // Unknown escape - just include the character
          content += nextChar;
        }
        i += 2;
      } else {
        i++;
      }
    } else if (c === "'") {
      // Closing quote
      i++;
      break;
    } else {
      content += c;
      i++;
    }
  }

  // Convert content to JSON-safe string
  const jsonString = escapeForJson(content);
  return ['"' + jsonString + '"', i];
}

/**
 * Escape a string for JSON output
 */
function escapeForJson(str: string): string {
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const code = ch.charCodeAt(0);

    if (ch === "\\") {
      result += "\\\\";
    } else if (ch === '"') {
      result += '\\"';
    } else if (ch === "\n") {
      result += "\\n";
    } else if (ch === "\r") {
      result += "\\r";
    } else if (ch === "\t") {
      result += "\\t";
    } else if (ch === "\b") {
      result += "\\b";
    } else if (ch === "\f") {
      result += "\\f";
    } else if (code < 32) {
      // Other control characters
      result += "\\u" + code.toString(16).padStart(4, "0");
    } else {
      result += ch;
    }
  }
  return result;
}

/**
 * Remove JavaScript-style comments
 */
function removeComments(input: string): string {
  let result = "";
  let i = 0;

  while (i < input.length) {
    // Skip strings
    if (input[i] === '"') {
      const [str, newIndex] = readDoubleQuotedString(input, i);
      result += str;
      i = newIndex;
      continue;
    }

    if (input[i] === "'") {
      // For comments, just skip single-quoted strings
      result += input[i];
      i++;
      while (i < input.length && input[i] !== "'") {
        if (input[i] === "\\" && i + 1 < input.length) {
          result += input[i] + input[i + 1];
          i += 2;
        } else {
          result += input[i];
          i++;
        }
      }
      if (i < input.length) {
        result += input[i];
        i++;
      }
      continue;
    }

    // Check for comments
    if (input[i] === "/" && i + 1 < input.length) {
      if (input[i + 1] === "/") {
        // Single-line comment
        i += 2;
        while (i < input.length && input[i] !== "\n") {
          i++;
        }
        continue;
      } else if (input[i + 1] === "*") {
        // Multi-line comment
        i += 2;
        while (i < input.length - 1) {
          if (input[i] === "*" && input[i + 1] === "/") {
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
 * Remove trailing commas before closing brackets
 */
function fixTrailingCommas(input: string): string {
  // Simple approach - just remove commas before } or ]
  return input
    .replace(/,(\s*})/g, "$1")
    .replace(/,(\s*\])/g, "$1");
}

/**
 * Add quotes to unquoted object keys
 */
function fixUnquotedKeys(input: string): string {
  return input.replace(
    /([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g,
    '$1"$2"$3'
  );
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
