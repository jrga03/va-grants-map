// Complete Excel to JSON Processor Script
// Processes "Summary-by province-all prog" sheet into structured JSON

import * as XLSX from "xlsx";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

// Configuration - modify these as needed
const CONFIG = {
  FILENAME: "areas_by_program_active_current_VVcorrected_AEforMapDashboard_0619.xlsx",
  SHEET_NAME: "Summary-by province-all prog",
  DATA_START_ROW: 4, // Row where data starts (0-indexed)
  OUTPUT_DIR: "./output", // Directory to save output files
  COLUMNS: {
    REGION: 0, // Column A (ignored)
    PROVINCE: 1, // Column B - First Subdivision Name
    SUBDIVISION: 2, // Column C - Second Subdivision Name
    PROGRAM: 3, // Column D - Program
  },
};

/**
 * Generate timestamp string for filename
 */
function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * Check if file or directory exists
 */
async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure output directory exists
 */
async function ensureOutputDir() {
  if (!(await exists(CONFIG.OUTPUT_DIR))) {
    await mkdir(CONFIG.OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${CONFIG.OUTPUT_DIR}`);
  }
}

/**
 * Write JSON to file with timestamp
 */
async function writeJsonToFile(jsonString, stats) {
  try {
    await ensureOutputDir();

    const timestamp = getTimestamp();
    const filename = `processed-${timestamp}.json`;
    const filepath = path.join(CONFIG.OUTPUT_DIR, filename);

    await writeFile(filepath, jsonString, "utf8");

    console.log(`\n✅ JSON file saved successfully!`);
    console.log(`📁 File: ${filepath}`);
    console.log(`📊 Size: ${(jsonString.length / 1024).toFixed(2)} KB`);
    console.log(`📈 Contains: ${stats.provinces} provinces, ${stats.subdivisions} subdivisions`);

    return filepath;
  } catch (error) {
    console.error("❌ Error writing JSON file:", error.message);
    throw error;
  }
}

/**
 * Process programs according to business rules:
 * 1. Replace MMMS with MMS
 * 2. Split programs by "&"
 * 3. Combine VAS + Deworming into VAS+D
 * 4. Remove duplicates and sort
 */
function processPrograms(programStrings) {
  let allPrograms = [];

  // Step 1 & 2: Replace MMMS and split by "&"
  programStrings.forEach((programStr) => {
    // Replace MMMS with MMS (case insensitive)
    programStr = programStr.replace(/MMMS/gi, "MMS");

    // Split by "&" and clean up
    const splitPrograms = programStr
      .split("&")
      .map((p) => p.trim())
      .filter((p) => p);
    allPrograms.push(...splitPrograms);
  });

  // Convert to lowercase for processing
  const uniquePrograms = [...new Set(allPrograms.map((p) => p.toLowerCase()))];

  // Step 3: Check for VAS+D combination logic
  const hasVAS = uniquePrograms.includes("vas");
  const hasDeworming = uniquePrograms.includes("deworming");
  const hasVASD = uniquePrograms.includes("vas+d");

  let finalPrograms = [];

  // If we have VAS+D already, or if we have both VAS and Deworming
  if (hasVASD || (hasVAS && hasDeworming)) {
    finalPrograms.push("VAS+D");

    // Add other programs except VAS and Deworming (since they're now VAS+D)
    uniquePrograms.forEach((program) => {
      const upperProgram = program.toUpperCase();
      if (upperProgram !== "VAS" && upperProgram !== "DEWORMING" && upperProgram !== "VAS+D") {
        finalPrograms.push(upperProgram);
      }
    });
  } else {
    // No combination needed, just convert to uppercase
    uniquePrograms.forEach((program) => {
      finalPrograms.push(program.toUpperCase());
    });
  }

  // Step 4: Remove duplicates and sort
  return [...new Set(finalPrograms)].sort();
}

/**
 * Main processing function
 */
async function processExcelToJson() {
  try {
    if (!(await exists(path.join(import.meta.dirname, CONFIG.FILENAME)))) {
      throw new Error(`File not found: ${CONFIG.FILENAME}`);
    }

    // Read file as buffer and parse with XLSX
    const buffer = await readFile(path.join(import.meta.dirname, CONFIG.FILENAME));
    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellStyles: true,
      cellFormulas: true,
      cellDates: true,
      cellNF: true,
      sheetStubs: true,
    });

    // Get the target sheet
    const sheet = workbook.Sheets[CONFIG.SHEET_NAME];
    if (!sheet) {
      throw new Error(`Sheet "${CONFIG.SHEET_NAME}" not found`);
    }

    const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`Total rows in sheet: ${sheetData.length}`);

    // Extract and clean raw data
    console.log("Processing raw data...");
    const rawData = [];
    let previousProvince = "";
    let previousSubdivision = "";

    for (let i = CONFIG.DATA_START_ROW; i < sheetData.length; i++) {
      const row = sheetData[i];
      if (!row || row.length === 0) continue;

      let province = row[CONFIG.COLUMNS.PROVINCE] || "";
      let subdivision = row[CONFIG.COLUMNS.SUBDIVISION] || "";
      let program = row[CONFIG.COLUMNS.PROGRAM] || "";

      // Handle blank province names - use previous entry
      if (province.trim() === "" || province === "(blank)") {
        province = previousProvince;
      } else {
        previousProvince = province;
      }

      // Handle blank subdivision names - use previous, or line number if no previous
      if (subdivision.trim() === "" || subdivision === "(blank)") {
        if (previousSubdivision === "") {
          subdivision = `Line_${i + 1}`;
        } else {
          subdivision = previousSubdivision;
        }
      } else {
        previousSubdivision = subdivision;
      }

      // Skip if program is blank
      if (program && program.trim() !== "" && program !== "(blank)") {
        rawData.push({
          province: province.trim(),
          subdivision: subdivision.trim(),
          program: program.trim(),
        });
      }
    }

    console.log(`Processed ${rawData.length} records`);

    // Group data by province and subdivision
    console.log("Grouping data...");
    const groupedData = {};

    rawData.forEach((item) => {
      const { province, subdivision, program } = item;

      // Initialize province if it doesn't exist
      if (!groupedData[province]) {
        groupedData[province] = {};
      }

      // Initialize subdivision if it doesn't exist
      if (!groupedData[province][subdivision]) {
        groupedData[province][subdivision] = [];
      }

      // Add program to subdivision
      groupedData[province][subdivision].push(program);
    });

    // Build final JSON structure
    console.log("Building final JSON structure...");
    const result = [];

    Object.keys(groupedData).forEach((provinceName) => {
      const provinceData = {
        name: provinceName,
        subdivisions: [],
      };

      Object.keys(groupedData[provinceName]).forEach((subdivisionName) => {
        const programs = groupedData[provinceName][subdivisionName];
        const processedPrograms = processPrograms(programs);

        provinceData.subdivisions.push({
          name: subdivisionName,
          programs: processedPrograms,
        });
      });

      // Sort subdivisions by name
      provinceData.subdivisions.sort((a, b) => a.name.localeCompare(b.name));
      result.push(provinceData);
    });

    // Sort provinces by name
    result.sort((a, b) => a.name.localeCompare(b.name));

    // Generate final JSON
    const finalJSON = JSON.stringify(result, null, 2);

    // Statistics
    const totalSubdivisions = result.reduce(
      (sum, province) => sum + province.subdivisions.length,
      0
    );
    const maxProvince = result.reduce((max, province) =>
      province.subdivisions.length > max.subdivisions.length ? province : max
    );

    console.log("Processing complete!");
    console.log(`Total provinces: ${result.length}`);
    console.log(`Total subdivisions: ${totalSubdivisions}`);
    console.log(`JSON character count: ${finalJSON.length}`);
    console.log(
      `Province with most subdivisions: ${maxProvince.name} (${maxProvince.subdivisions.length} subdivisions)`
    );

    // Save results
    // window.processedData = result;
    // window.processedJSON = finalJSON;

    const stats = {
      provinces: result.length,
      subdivisions: totalSubdivisions,
      records: rawData.length,
      jsonLength: finalJSON.length,
    };

    writeJsonToFile(finalJSON, stats);

    return {
      data: result,
      json: finalJSON,
      stats,
    };
  } catch (error) {
    console.error("Error processing Excel file:", error);
    throw error;
  }
}

/*
USAGE EXAMPLES:

1. Basic usage:
   const result = await processExcelToJson();
   console.log(result.json);

2. Get just the data:
   const result = await processExcelToJson();
   console.log(result.data);

3. Access saved results:
   await processExcelToJson();
   console.log(window.processedJSON);

4. Modify program processing logic:
   // Edit the processPrograms() function above
   
5. Change configuration:
   // Edit the CONFIG object at the top

CUSTOMIZATION POINTS:

- CONFIG: Change file names, sheet names, column mappings
- processPrograms(): Modify business logic for program combinations
- DATA_START_ROW: Adjust if headers are in different row
- Add new program transformation rules in processPrograms()
- Modify JSON structure in the "Build final JSON structure" section
*/

await processExcelToJson();
