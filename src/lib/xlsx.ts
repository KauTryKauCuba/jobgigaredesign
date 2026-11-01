import "server-only";
import JSZip from "jszip";

// A minimal .xlsx writer — one sheet, a bold frozen header row with filter
// arrows, set column widths, and real date cells (so Excel sorts and filters
// them as dates). An .xlsx is just a zip of a few XML files, so this covers
// what the exports need without a full spreadsheet library.

export type XlsxCell = string | number | Date | null | undefined;
export type XlsxColumn = { header: string; width: number; format?: "date" | "datetime" };

const TIME_ZONE_OFFSET_MS = 8 * 60 * 60 * 1000; // Malaysia (UTC+8, no daylight saving)
const EXCEL_EPOCH_OFFSET_DAYS = 25569; // 1970-01-01 as an Excel serial day
const MAX_CELL_CHARS = 32_000; // Excel's hard limit is 32,767

const STYLE = { header: 1, date: 2, datetime: 3 } as const;

function escapeXml(value: string): string {
  return value
    .slice(0, MAX_CELL_CHARS)
    // Control characters (other than tab/newline) make the file unreadable.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/** Malaysia wall-clock time as an Excel serial date. */
function excelSerial(date: Date): number {
  return (date.getTime() + TIME_ZONE_OFFSET_MS) / 86_400_000 + EXCEL_EPOCH_OFFSET_DAYS;
}

function cellXml(ref: string, value: XlsxCell, column: XlsxColumn): string {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const style = column.format === "datetime" ? STYLE.datetime : STYLE.date;
    return `<c r="${ref}" s="${style}"><v>${excelSerial(value)}</v></c>`;
  }
  if (typeof value === "number") return Number.isFinite(value) ? `<c r="${ref}"><v>${value}</v></c>` : "";
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

export async function buildXlsx(sheetName: string, columns: XlsxColumn[], rows: XlsxCell[][]): Promise<Buffer> {
  const name = escapeXml(sheetName.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet1");
  const lastColumn = columnLetter(columns.length - 1);
  const lastRow = rows.length + 1;

  const header = `<row r="1">${columns
    .map((c, i) => `<c r="${columnLetter(i)}1" t="inlineStr" s="${STYLE.header}"><is><t>${escapeXml(c.header)}</t></is></c>`)
    .join("")}</row>`;
  const body = rows
    .map(
      (row, r) =>
        `<row r="${r + 2}">${columns.map((c, i) => cellXml(`${columnLetter(i)}${r + 2}`, row[i], c)).join("")}</row>`,
    )
    .join("");

  const sheet =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>${columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`).join("")}</cols>` +
    `<sheetData>${header}${body}</sheetData>` +
    `<autoFilter ref="A1:${lastColumn}${lastRow}"/>` +
    `</worksheet>`;

  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets>` +
    `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${name.replace(/'/g, "''")}'!$A$1:$${lastColumn}$${lastRow}</definedName></definedNames>` +
    `</workbook>`;

  const styles =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<numFmts count="2"><numFmt numFmtId="164" formatCode="d mmm yyyy"/><numFmt numFmtId="165" formatCode="d mmm yyyy h:mm AM/PM"/></numFmts>` +
    `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
    `<fill><patternFill patternType="solid"><fgColor rgb="FFEAF4F4"/><bgColor indexed="64"/></patternFill></fill></fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="4">` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
    `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
    `<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
    `</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `</styleSheet>`;

  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      `</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`,
  );
  zip.file("xl/workbook.xml", workbook);
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `</Relationships>`,
  );
  zip.file("xl/worksheets/sheet1.xml", sheet);
  zip.file("xl/styles.xml", styles);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
