import type { InputCell, MonthlyPattern, SheetAnalysis } from "./excel-analyzer";

export interface FieldMapping {
  cells: string[];
  type: string;
  is_monthly: boolean;
  example: unknown;
  max_num_of_values: number;
  description: string;
  values: unknown[];
  formulas: string[];
  cell_labels?: string[];
}

export interface SheetMapping {
  sheet_name: string;
  [fieldName: string]: string | FieldMapping;
}

// CRE field descriptions
const fieldDescriptions: Record<string, string> = {
  "property name": "The legal or common name of the real estate asset.",
  address: "The street address of the property.",
  city: "The city where the property is located.",
  state: "The state where the property is located.",
  zip: "The ZIP code of the property location.",
  "year built": "The year the property was originally constructed.",
  units: "Total count of individual rental units within the property.",
  "# of units": "Total count of individual rental units within the property.",
  "number of units":
    "Total count of individual rental units within the property.",
  "square feet": "Total rentable or gross square footage of the property.",
  sf: "Total rentable or gross square footage of the property.",
  sqft: "Total rentable or gross square footage of the property.",
  "purchase price": "The acquisition cost of the property.",
  price: "The acquisition or sale price of the property.",
  "cap rate": "Capitalization rate - NOI divided by property value.",
  noi: "Net Operating Income - revenue minus operating expenses.",
  vacancy: "Percentage or amount of unoccupied units.",
  occupancy: "Percentage of units currently leased.",
  rent: "Rental income from tenants.",
  "gross potential rent":
    "Total market rent if 100% occupied at market rates.",
  "effective gross income":
    "Gross potential rent minus vacancy and concessions.",
  "operating expenses": "Total costs to operate the property.",
  "debt service": "Annual principal and interest payments on loans.",
  "cash flow": "Net income after all expenses and debt service.",
  irr: "Internal Rate of Return - annualized investment return.",
  "interest rate": "Annual interest rate on the loan.",
  "loan amount": "Principal amount borrowed.",
  ltv: "Loan-to-Value ratio - loan amount divided by property value.",
};

function getFieldDescription(name: string, type: string): string {
  const nameLower = name.toLowerCase();

  for (const [key, desc] of Object.entries(fieldDescriptions)) {
    if (nameLower.includes(key)) {
      return desc;
    }
  }

  // Generic description based on type
  const typeDescriptions: Record<string, string> = {
    number: `Numeric value for ${name}.`,
    currency: `Dollar amount for ${name}.`,
    percentage: `Percentage value for ${name}.`,
    date: `Date value for ${name}.`,
    string: `Text value for ${name}.`,
  };

  return typeDescriptions[type] || `Value for ${name}.`;
}

function getMonthlyDescription(label: string): string {
  const labelLower = label.toLowerCase();

  const monthlyDescriptions: Record<string, string> = {
    "gross potential rent":
      "Total market rent potential for all units if 100% occupied at market rates.",
    gpr: "Total market rent potential for all units if 100% occupied at market rates.",
    vacancy: "Lost rental income due to unoccupied units.",
    "vacancy loss": "Lost rental income due to unoccupied units.",
    concessions: "Rent discounts or incentives offered to tenants.",
    "other income": "Non-rental income such as parking, laundry, or fees.",
    "effective gross income": "Total income after vacancy and concessions.",
    egi: "Total income after vacancy and concessions.",
    "operating expenses": "Total monthly costs to operate the property.",
    opex: "Total monthly costs to operate the property.",
    noi: "Net Operating Income - monthly revenue minus operating expenses.",
    "net operating income":
      "Net Operating Income - monthly revenue minus operating expenses.",
    "debt service": "Monthly principal and interest payments.",
    "cash flow": "Monthly net income after all expenses and debt.",
  };

  for (const [key, desc] of Object.entries(monthlyDescriptions)) {
    if (labelLower.includes(key)) {
      return desc;
    }
  }

  return `Monthly values for ${label} over a 12-month period.`;
}

function cleanFieldName(name: string | null): string {
  if (!name) return "Unknown Field";

  let cleaned = name.trim().replace(/:$/, "");

  // Title case if all lowercase or all uppercase
  if (cleaned === cleaned.toLowerCase() || cleaned === cleaned.toUpperCase()) {
    cleaned = cleaned
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  return cleaned;
}

export function generateMapping(analysis: SheetAnalysis): SheetMapping {
  const mapping: SheetMapping = {
    sheet_name: analysis.sheetName,
  };

  // Collect cells that are part of monthly patterns
  const monthlyCells = new Set<string>();
  for (const pattern of analysis.monthlyPatterns) {
    for (const cell of pattern.cells) {
      monthlyCells.add(cell);
    }
  }

  // Add monthly patterns first
  for (const pattern of analysis.monthlyPatterns) {
    const label = cleanFieldName(pattern.label) || `Monthly_Row_${pattern.row}`;

    mapping[label] = {
      cells: pattern.cells,
      type: "number",
      is_monthly: true,
      example: pattern.values.slice(0, 3),
      max_num_of_values: 12,
      description: getMonthlyDescription(label),
      values: [],
      formulas: [],
      cell_labels: Array.from({ length: 12 }, (_, i) => `Month ${i + 1}`),
    };
  }

  // Add individual input cells (skip those in monthly patterns)
  for (const cell of analysis.inputCells) {
    if (monthlyCells.has(cell.cell)) continue;

    const fieldName = cleanFieldName(cell.label) || `Field_${cell.cell}`;

    // Skip if we already have this field name
    if (mapping[fieldName]) continue;

    mapping[fieldName] = {
      cells: [cell.cell],
      type: cell.type,
      is_monthly: false,
      example: cell.value,
      max_num_of_values: 1,
      description: getFieldDescription(fieldName, cell.type),
      values: [],
      formulas: [],
    };
  }

  return mapping;
}
