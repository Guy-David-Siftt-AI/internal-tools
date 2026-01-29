import { NextRequest, NextResponse } from "next/server";
import {
  analyzeExcelFile,
  analyzeSheet,
  classifySheet,
} from "@/lib/underwriting-mapper/excel-analyzer";
import { generateMapping, type SheetMapping } from "@/lib/underwriting-mapper/mapping-generator";
import { generateMappingWithAI } from "@/lib/underwriting-mapper/agent";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const action = formData.get("action") as string || "generate";
    const useAI = formData.get("useAI") === "true";
    const aiNotes = formData.get("aiNotes") as string || "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      return NextResponse.json(
        { error: "File must be an Excel file (.xlsx or .xls)" },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();

    // Analyze the Excel file
    const analysis = await analyzeExcelFile(buffer, file.name);

    if (!analysis.success) {
      return NextResponse.json(
        { error: "Failed to analyze Excel file" },
        { status: 500 }
      );
    }

    // Handle different actions
    switch (action) {
      case "analyze":
        return handleAnalyze(buffer, analysis);

      case "list-fields": {
        const sheetName = formData.get("sheet") as string;
        return handleListFields(buffer, sheetName);
      }

      case "generate":
      default:
        return handleGenerate(buffer, analysis, useAI, aiNotes);
    }
  } catch (error) {
    console.error("Error processing Excel file:", error);
    return NextResponse.json(
      { error: "Failed to process Excel file" },
      { status: 500 }
    );
  }
}

async function handleAnalyze(
  buffer: ArrayBuffer,
  analysis: Awaited<ReturnType<typeof analyzeExcelFile>>
) {
  const sheetDetails = [];

  for (const sheet of analysis.sheets) {
    try {
      const sheetAnalysis = await analyzeSheet(buffer, sheet.name);
      const sheetType = classifySheet(sheet.name, sheetAnalysis.inputCells);

      sheetDetails.push({
        name: sheet.name,
        type: sheetType,
        rows: sheet.maxRow,
        columns: sheet.maxColumn,
        inputCount: sheetAnalysis.inputCount,
        formulaCount: sheetAnalysis.formulaCount,
        monthlyPatterns: sheetAnalysis.monthlyPatterns.length,
      });
    } catch (err) {
      console.error(`Error analyzing sheet ${sheet.name}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    action: "analyze",
    modelName: analysis.modelName,
    sheetCount: analysis.sheetCount,
    sheets: sheetDetails,
  });
}

async function handleListFields(buffer: ArrayBuffer, sheetName: string) {
  if (!sheetName) {
    return NextResponse.json(
      { error: "Sheet name is required for list-fields action" },
      { status: 400 }
    );
  }

  try {
    const sheetAnalysis = await analyzeSheet(buffer, sheetName);

    return NextResponse.json({
      success: true,
      action: "list-fields",
      sheetName,
      inputCells: sheetAnalysis.inputCells,
      monthlyPatterns: sheetAnalysis.monthlyPatterns,
      labels: sheetAnalysis.sampleLabels,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to analyze sheet: ${err}` },
      { status: 500 }
    );
  }
}

async function handleGenerate(
  buffer: ArrayBuffer,
  analysis: Awaited<ReturnType<typeof analyzeExcelFile>>,
  useAI: boolean = false,
  aiNotes: string = ""
) {
  const mappings: Record<string, SheetMapping> = {};
  const sheetDetails: {
    name: string;
    type: string;
    fieldCount: number;
  }[] = [];

  for (const sheet of analysis.sheets) {
    try {
      const sheetAnalysis = await analyzeSheet(buffer, sheet.name);
      const sheetType = classifySheet(sheet.name, sheetAnalysis.inputCells);

      // Skip summary sheets
      if (sheetType === "summary") continue;

      // Generate mapping (with or without AI)
      const mapping = useAI
        ? await generateMappingWithAI(sheetAnalysis, sheetType, aiNotes)
        : generateMapping(sheetAnalysis);

      const fieldCount = Object.keys(mapping).length - 1; // Exclude sheet_name

      if (fieldCount > 0) {
        // Use sheet name to ensure unique keys (sanitize for filename)
        const sanitizedSheetName = sheet.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
        const mappingKey = `${analysis.modelName}_${sanitizedSheetName}_${sheetType}`;
        mappings[mappingKey] = mapping;
        sheetDetails.push({
          name: sheet.name,
          type: sheetType,
          fieldCount,
        });
      }
    } catch (err) {
      console.error(`Error analyzing sheet ${sheet.name}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    action: "generate",
    modelName: analysis.modelName,
    sheetCount: analysis.sheetCount,
    sheets: sheetDetails,
    mappings,
  });
}

// Validate mapping endpoint
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { mapping } = body;

    if (!mapping) {
      return NextResponse.json(
        { error: "No mapping provided" },
        { status: 400 }
      );
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required top-level field
    if (!mapping.sheet_name) {
      errors.push("Missing 'sheet_name' field");
    }

    // Check field structure
    let fieldCount = 0;
    for (const [key, value] of Object.entries(mapping)) {
      if (key === "sheet_name") continue;

      fieldCount++;

      if (typeof value !== "object" || value === null) {
        errors.push(`Field '${key}' is not a dictionary`);
        continue;
      }

      const field = value as Record<string, unknown>;

      // Check required field properties
      const required = ["cells", "type", "is_monthly", "description"];
      for (const prop of required) {
        if (!(prop in field)) {
          warnings.push(`Field '${key}' missing '${prop}'`);
        }
      }

      // Check cells is a list
      if ("cells" in field && !Array.isArray(field.cells)) {
        errors.push(`Field '${key}' cells should be a list`);
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      action: "validate",
      fieldCount,
      errors,
      warnings,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }
}
