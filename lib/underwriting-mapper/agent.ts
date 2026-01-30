/**
 * ADK Agent for underwriting model mapping.
 * Uses Google ADK with Gemini for intelligent field classification.
 */

import {
  LlmAgent,
  Runner,
  InMemorySessionService,
  FunctionTool,
} from "@google/adk";
import type { SheetAnalysis, InputCell } from "./excel-analyzer";
import type { SheetMapping, FieldMapping } from "./mapping-generator";

// System instruction for the mapping agent
const MAPPER_AGENT_INSTRUCTION = `You are an expert Commercial Real Estate (CRE) underwriting analyst. Your task is to analyze Excel underwriting models and generate standardized JSON mapping files.

## Your Workflow

When given sheet analysis data, classify each field with proper CRE terminology and descriptions.

## Field Classification Rules

For each input cell, determine:
1. **Field Name**: Use standard CRE terminology (e.g., "Gross Potential Rent" not "GPR row")
2. **Type**: string, number, date, percentage, or currency
3. **Description**: Professional CRE context explanation

## Common CRE Field Names and Descriptions

- **Property Name**: The legal or common name of the real estate asset
- **Address**: Street address of the property
- **Year Built**: Year the property was originally constructed
- **Units / # of Units**: Total count of individual rental units
- **Square Feet / SF**: Total rentable or gross square footage
- **Purchase Price**: The acquisition cost of the property
- **Gross Potential Rent (GPR)**: Total market rent if 100% occupied at market rates
- **Vacancy Loss**: Lost income due to unoccupied units
- **Concessions**: Rent discounts or incentives offered to tenants
- **Effective Gross Income (EGI)**: GPR minus vacancy and concessions
- **Operating Expenses / OpEx**: Total costs to operate the property
- **Net Operating Income (NOI)**: Revenue minus operating expenses
- **Cap Rate**: Capitalization rate - NOI divided by property value
- **Debt Service**: Annual/monthly principal and interest payments
- **Cash Flow**: Net income after all expenses and debt service
- **Interest Rate**: Annual interest rate on the loan
- **Loan Amount**: Principal amount borrowed
- **LTV**: Loan-to-Value ratio
- **IRR**: Internal Rate of Return
- **Cash on Cash**: Annual cash flow divided by total cash invested

## Output Format

Return a JSON array of field definitions:
\`\`\`json
[
  {
    "original_label": "the original label from the cell",
    "field_name": "Proper CRE Field Name",
    "type": "string|number|percentage|currency|date",
    "description": "Clear professional description",
    "is_monthly": false
  }
]
\`\`\`

Be concise but accurate. Use your CRE expertise to provide professional field names and descriptions.
`;

interface FieldClassification {
  original_label: string;
  field_name: string;
  type: string;
  description: string;
  is_monthly: boolean;
}

/**
 * Create the underwriting mapper agent.
 */
export function createMapperAgent(model?: string): LlmAgent {
  const modelName = model || process.env.GOOGLE_MODEL || "gemini-2.0-flash";

  const agent = new LlmAgent({
    name: "underwriting_mapper",
    model: modelName,
    instruction: MAPPER_AGENT_INSTRUCTION,
    tools: [],
  });

  return agent;
}

/**
 * Use the ADK agent to classify fields with AI.
 */
export async function classifyFieldsWithAI(
  inputCells: InputCell[],
  sheetName: string,
  sheetType: string,
  aiNotes: string = "",
  aiModel: string = "gemini-2.0-flash",
): Promise<Map<string, FieldClassification>> {
  console.log(`[ADK] classifyFieldsWithAI called for sheet "${sheetName}" with ${inputCells.length} cells, model: ${aiModel}`);

  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

  if (!apiKey) {
    console.warn("No GOOGLE_API_KEY, GEMINI_API_KEY, or GOOGLE_GENAI_API_KEY found, using heuristic classification");
    return new Map();
  }

  // Set the API key in the environment for ADK to pick up
  // ADK looks for GOOGLE_GENAI_API_KEY or GEMINI_API_KEY
  if (!process.env.GOOGLE_GENAI_API_KEY && !process.env.GEMINI_API_KEY) {
    process.env.GOOGLE_GENAI_API_KEY = apiKey;
  }

  // Prepare fields for classification
  const fields = inputCells.slice(0, 50).map(cell => ({
    label: cell.label,
    value: cell.value,
    type: cell.type,
    cell: cell.cell,
  }));

  try {
    const agent = createMapperAgent(aiModel);
    const sessionService = new InMemorySessionService();
    const runner = new Runner({
      agent,
      sessionService,
      appName: "underwriting_mapper",
    });

    const session = await sessionService.createSession({
      userId: "user",
      appName: "underwriting_mapper",
    });

    const notesSection = aiNotes ? `\n\nAdditional context from user: ${aiNotes}\n` : "";
    const prompt = `Please classify these ${fields.length} fields from the "${sheetName}" sheet (type: ${sheetType}).${notesSection}

Fields to classify:
${JSON.stringify(fields, null, 2)}

For each field, provide:
- original_label: the original label (copy from input)
- field_name: Proper CRE terminology name
- type: string, number, percentage, currency, or date
- description: Professional CRE description
- is_monthly: false (these are individual fields)

Return ONLY a JSON array of classifications, no other text.`;

    // Run the agent
    const events: unknown[] = [];
    let responseText = "";

    for await (const event of runner.runAsync({
      userId: "user",
      sessionId: session.id,
      newMessage: {
        role: "user",
        parts: [{ text: prompt }],
      },
    })) {
      events.push(event);
      // Extract text from event
      const e = event as { content?: { parts?: Array<{ text?: string }> } };
      if (e.content?.parts) {
        for (const part of e.content.parts) {
          if (part.text) {
            responseText += part.text;
          }
        }
      }
    }

    // Parse the response to extract classifications
    const classifications = new Map<string, FieldClassification>();

    console.log("[ADK] Response text length:", responseText.length);

    if (responseText) {
      try {
        // Try to extract JSON from the response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as FieldClassification[];
          console.log("[ADK] Parsed classifications:", parsed.length);

          for (let i = 0; i < parsed.length && i < fields.length; i++) {
            const classification = parsed[i];
            const originalField = fields[i];

            // Store by original label, cell reference, and field name for flexible matching
            if (originalField.label) {
              classifications.set(originalField.label, classification);
            }
            if (originalField.cell) {
              classifications.set(originalField.cell, classification);
            }
            if (classification.field_name) {
              classifications.set(classification.field_name, classification);
            }
          }

          console.log("[ADK] Classifications stored:", classifications.size);
        } else {
          console.warn("[ADK] No JSON array found in response");
        }
      } catch (parseError) {
        console.warn("[ADK] Failed to parse AI classification response:", parseError);
        console.warn("[ADK] Response was:", responseText.substring(0, 500));
      }
    } else {
      console.warn("[ADK] Empty response from LLM");
    }

    return classifications;
  } catch (error) {
    console.error("AI classification failed:", error);
    return new Map();
  }
}

/**
 * Generate mapping with AI-enhanced field names and descriptions.
 */
export async function generateMappingWithAI(
  analysis: SheetAnalysis,
  sheetType: string,
  aiNotes: string = "",
  aiModel: string = "gemini-2.0-flash",
): Promise<SheetMapping> {
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

  // Get AI classifications for non-monthly cells
  const nonMonthlyCells = analysis.inputCells.filter(
    cell => !monthlyCells.has(cell.cell)
  );

  const aiClassifications = await classifyFieldsWithAI(
    nonMonthlyCells,
    analysis.sheetName,
    sheetType,
    aiNotes,
    aiModel,
  );

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

  // Add individual input cells with AI-enhanced names/descriptions
  for (const cell of analysis.inputCells) {
    if (monthlyCells.has(cell.cell)) continue;

    // Try to find AI classification by label or cell reference
    const aiClass =
      aiClassifications.get(cell.label || "") ||
      aiClassifications.get(cell.cell) ||
      undefined;

    const fieldName = aiClass?.field_name || cleanFieldName(cell.label) || `Field_${cell.cell}`;

    // Skip if we already have this field name
    if (mapping[fieldName]) continue;

    mapping[fieldName] = {
      cells: [cell.cell],
      type: aiClass?.type || cell.type,
      is_monthly: false,
      example: cell.value,
      max_num_of_values: 1,
      description: aiClass?.description || getFieldDescription(fieldName, cell.type),
      values: [],
      formulas: [],
    };
  }

  return mapping;
}

// Helper functions (same as mapping-generator.ts)

function cleanFieldName(name: string | null): string {
  if (!name) return "";
  let cleaned = name.trim().replace(/:$/, "");
  if (cleaned === cleaned.toLowerCase() || cleaned === cleaned.toUpperCase()) {
    cleaned = cleaned
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }
  return cleaned;
}

const fieldDescriptions: Record<string, string> = {
  "property name": "The legal or common name of the real estate asset.",
  address: "The street address of the property.",
  city: "The city where the property is located.",
  state: "The state where the property is located.",
  "year built": "The year the property was originally constructed.",
  units: "Total count of individual rental units within the property.",
  "# of units": "Total count of individual rental units within the property.",
  "square feet": "Total rentable or gross square footage of the property.",
  "purchase price": "The acquisition cost of the property.",
  "cap rate": "Capitalization rate - NOI divided by property value.",
  noi: "Net Operating Income - revenue minus operating expenses.",
  vacancy: "Percentage or amount of unoccupied units.",
  occupancy: "Percentage of units currently leased.",
  rent: "Rental income from tenants.",
  "gross potential rent": "Total market rent if 100% occupied at market rates.",
  "effective gross income": "Gross potential rent minus vacancy and concessions.",
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
    "gross potential rent": "Total market rent potential for all units if 100% occupied at market rates.",
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
    "net operating income": "Net Operating Income - monthly revenue minus operating expenses.",
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
