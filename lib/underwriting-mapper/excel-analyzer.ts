import ExcelJS from "exceljs";

export interface SheetInfo {
  name: string;
  maxRow: number;
  maxColumn: number;
}

export interface InputCell {
  cell: string;
  value: unknown;
  label: string | null;
  row: number;
  col: number;
  type: string;
}

export interface MonthlyPattern {
  row: number;
  label: string | null;
  cells: string[];
  values: unknown[];
}

export interface SheetAnalysis {
  sheetName: string;
  inputCount: number;
  formulaCount: number;
  labelCount: number;
  inputCells: InputCell[];
  monthlyPatterns: MonthlyPattern[];
  sampleLabels: { cell: string; value: string }[];
}

export interface ExcelAnalysis {
  success: boolean;
  filePath: string;
  modelName: string;
  sheetCount: number;
  sheets: SheetInfo[];
}

function isNumericString(value: string): boolean {
  if (!value) return false;
  const cleaned = value
    .replace(/,/g, "")
    .replace(/\$/g, "")
    .replace(/%/g, "")
    .replace(/\(/g, "-")
    .replace(/\)/g, "")
    .trim();
  return !isNaN(parseFloat(cleaned));
}

function detectType(value: unknown): string {
  if (value === null || value === undefined) return "string";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") {
    if (value >= 0 && value <= 1) return "percentage";
    return "number";
  }
  if (value instanceof Date) return "date";
  if (typeof value === "string") {
    if (value.includes("%")) return "percentage";
    if (value.includes("$")) return "currency";
    if (isNumericString(value)) return "number";
  }
  return "string";
}

function getColumnLetter(col: number): string {
  let letter = "";
  while (col > 0) {
    const mod = (col - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

function findLabel(
  worksheet: ExcelJS.Worksheet,
  row: number,
  col: number
): string | null {
  // Check left
  if (col > 1) {
    const leftCell = worksheet.getCell(row, col - 1);
    if (leftCell.value && typeof leftCell.value === "string") {
      if (!isNumericString(leftCell.value)) {
        return String(leftCell.value).trim().slice(0, 100);
      }
    }
  }

  // Check two cells left
  if (col > 2) {
    const left2Cell = worksheet.getCell(row, col - 2);
    const left1Cell = worksheet.getCell(row, col - 1);
    if (
      left2Cell.value &&
      typeof left2Cell.value === "string" &&
      !left1Cell.value
    ) {
      if (!isNumericString(left2Cell.value)) {
        return String(left2Cell.value).trim().slice(0, 100);
      }
    }
  }

  // Check above
  if (row > 1) {
    const aboveCell = worksheet.getCell(row - 1, col);
    if (aboveCell.value && typeof aboveCell.value === "string") {
      if (!isNumericString(aboveCell.value)) {
        return String(aboveCell.value).trim().slice(0, 100);
      }
    }
  }

  return null;
}

export async function analyzeExcelFile(
  buffer: ArrayBuffer,
  fileName: string
): Promise<ExcelAnalysis> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const modelName = fileName.replace(/\.(xlsx|xls)$/i, "");

  const sheets: SheetInfo[] = [];
  workbook.worksheets.forEach((ws) => {
    sheets.push({
      name: ws.name,
      maxRow: ws.rowCount,
      maxColumn: ws.columnCount,
    });
  });

  return {
    success: true,
    filePath: fileName,
    modelName,
    sheetCount: sheets.length,
    sheets,
  };
}

export async function analyzeSheet(
  buffer: ArrayBuffer,
  sheetName: string
): Promise<SheetAnalysis> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    throw new Error(`Sheet '${sheetName}' not found`);
  }

  const inputCells: InputCell[] = [];
  const formulaCells: { cell: string; formula: string }[] = [];
  const labels: { cell: string; value: string }[] = [];

  // Use actualRowCount/actualColumnCount or fall back to reasonable defaults
  const maxRow = Math.min(
    worksheet.actualRowCount || worksheet.rowCount || 100,
    500
  );
  const maxCol = Math.min(
    worksheet.actualColumnCount || worksheet.columnCount || 26,
    50
  );

  // Iterate through actual rows for better compatibility
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > maxRow) return;

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (colNumber > maxCol) return;
      if (cell.value === null || cell.value === undefined) return;

      const colLetter = getColumnLetter(colNumber);
      const cellRef = `${colLetter}${rowNumber}`;

      // Check if formula
      const isFormula =
        cell.type === ExcelJS.ValueType.Formula ||
        (typeof cell.value === "object" &&
          cell.value !== null &&
          "formula" in cell.value);

      if (isFormula) {
        formulaCells.push({
          cell: cellRef,
          formula: String(
            typeof cell.value === "object" &&
              cell.value !== null &&
              "formula" in cell.value
              ? (cell.value as { formula: string }).formula
              : cell.value
          ),
        });
      } else if (
        typeof cell.value === "string" &&
        !isNumericString(cell.value)
      ) {
        // Text label
        labels.push({
          cell: cellRef,
          value: String(cell.value).slice(0, 100),
        });
      } else {
        // Input value (numbers, dates, numeric strings)
        const adjacentLabel = findLabel(worksheet, rowNumber, colNumber);
        const actualValue =
          typeof cell.value === "object" &&
          cell.value !== null &&
          "result" in cell.value
            ? (cell.value as { result: unknown }).result
            : cell.value;

        inputCells.push({
          cell: cellRef,
          value: actualValue,
          label: adjacentLabel,
          row: rowNumber,
          col: colNumber,
          type: detectType(actualValue),
        });
      }
    });
  });

  // Detect monthly patterns
  const monthlyPatterns = detectMonthlyPatterns(inputCells);

  return {
    sheetName,
    inputCount: inputCells.length,
    formulaCount: formulaCells.length,
    labelCount: labels.length,
    inputCells: inputCells.slice(0, 100),
    monthlyPatterns,
    sampleLabels: labels.slice(0, 30),
  };
}

function detectMonthlyPatterns(inputCells: InputCell[]): MonthlyPattern[] {
  // Group by row
  const byRow: Map<number, InputCell[]> = new Map();
  for (const cell of inputCells) {
    if (!byRow.has(cell.row)) {
      byRow.set(cell.row, []);
    }
    byRow.get(cell.row)!.push(cell);
  }

  const patterns: MonthlyPattern[] = [];
  for (const [row, cells] of byRow) {
    if (cells.length >= 12) {
      // Sort by column
      cells.sort((a, b) => a.col - b.col);

      // Look for 12 consecutive columns
      for (let i = 0; i <= cells.length - 12; i++) {
        const subset = cells.slice(i, i + 12);
        const cols = subset.map((c) => c.col);

        // Check if consecutive
        let isConsecutive = true;
        for (let j = 1; j < cols.length; j++) {
          if (cols[j] !== cols[j - 1] + 1) {
            isConsecutive = false;
            break;
          }
        }

        if (isConsecutive) {
          patterns.push({
            row,
            label: subset[0].label,
            cells: subset.map((c) => c.cell),
            values: subset.map((c) => c.value).slice(0, 3),
          });
          break;
        }
      }
    }
  }

  return patterns;
}

export function classifySheet(
  sheetName: string,
  inputCells: InputCell[]
): string {
  const nameLower = sheetName.toLowerCase();

  // Check sheet name patterns
  const namePatterns: Record<string, string[]> = {
    property_info: ["property", "info", "input", "general", "asset"],
    rent_roll: ["rent roll", "rr", "lease", "tenant", "unit list"],
    t12_pnl: [
      "t12",
      "t-12",
      "trailing",
      "pnl",
      "p&l",
      "income",
      "operating statement",
    ],
    unit_mix: ["unit mix", "mix", "unit type", "bedroom"],
    debt_inputs: ["debt", "loan", "financing", "mortgage"],
    projections: ["projection", "pro forma", "proforma", "forecast", "budget"],
    returns: ["return", "irr", "yield", "coc", "equity"],
    summary: ["summary", "dashboard", "overview", "kpi"],
    assumptions: ["assumption", "input", "variable"],
    operating: ["operating", "opex", "expense"],
    capital: ["capital", "capex", "renovation", "improvement"],
  };

  for (const [sheetType, patterns] of Object.entries(namePatterns)) {
    for (const pattern of patterns) {
      if (nameLower.includes(pattern)) {
        return sheetType;
      }
    }
  }

  // Check cell content patterns
  const allLabels = inputCells
    .map((c) => c.label?.toLowerCase() || "")
    .join(" ");
  const allValues = inputCells
    .map((c) => String(c.value).toLowerCase())
    .join(" ");
  const allText = allLabels + " " + allValues;

  const contentPatterns: Record<string, string[]> = {
    property_info: [
      "property name",
      "address",
      "year built",
      "square feet",
      "# of units",
    ],
    rent_roll: ["unit #", "unit number", "lease start", "lease end", "tenant"],
    t12_pnl: [
      "gross potential",
      "vacancy",
      "noi",
      "net operating",
      "effective gross",
    ],
    unit_mix: ["studio", "1br", "2br", "1 bed", "2 bed", "unit type"],
    debt_inputs: ["interest rate", "loan amount", "amortization", "ltv"],
    returns: ["irr", "cash on cash", "equity multiple", "cap rate"],
  };

  for (const [sheetType, patterns] of Object.entries(contentPatterns)) {
    const matches = patterns.filter((p) => allText.includes(p)).length;
    if (matches >= 2) {
      return sheetType;
    }
  }

  return "other";
}
