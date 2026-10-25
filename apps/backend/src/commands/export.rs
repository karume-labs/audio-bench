use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::BackendError;
use crate::jobs;

/// One raw row from an imported script file. No validation happens here —
/// ids are strings and the TypeScript domain layer validates them.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptRow {
    /// 1-based row number in the source file (a header row, when present,
    /// is row 1 and is not returned).
    pub row_number: u32,
    pub id: String,
    pub text: String,
}

/// Export request from the UI. Filenames are already resolved by the TS
/// naming engine; this layer only slices and writes bytes.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportRequest {
    pub master_path: String,
    pub out_dir: String,
    pub pre_window_s: f64,
    pub post_window_s: f64,
    pub fade_ms: f64,
    pub clips: Vec<ExportClip>,
    /// Verbatim `manifest.csv` content (written to `<outDir>/manifest.csv`).
    pub manifest_csv: String,
    /// Verbatim report content (written to `<outDir>/alignment_report.csv`).
    pub report_csv: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportClip {
    /// Final file name including the `.wav` extension.
    pub filename: String,
    pub core_start_sample: u64,
    pub core_end_sample: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub written_files: u32,
    pub out_dir: String,
    pub filenames: Vec<String>,
}

/// Import a `.csv` / `.txt` / `.xlsx` script file into raw rows.
#[tauri::command]
pub fn import_script(path: String) -> Result<Vec<ScriptRow>, BackendError> {
    let ext = Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    match ext.as_str() {
        "csv" | "txt" => import_delimited(&path),
        "xlsx" => import_workbook(&path),
        _ => Err(BackendError::InvalidRequest(format!(
            "Unsupported script format '.{}' (expected .csv, .txt or .xlsx)",
            ext
        ))),
    }
}

/// Slice the master into padded, faded, 24-bit clips and write the manifest
/// and alignment report next to them.
#[tauri::command]
pub async fn export_clips(request: ExportRequest) -> Result<ExportResult, BackendError> {
    tauri::async_runtime::spawn_blocking(move || jobs::export::run_export(&request))
        .await
        .map_err(|e| BackendError::Command(format!("export task failed: {}", e)))?
}

/// The default id pattern: exactly seven ASCII digits.
fn looks_like_id(value: &str) -> bool {
    value.len() == 7 && value.bytes().all(|b| b.is_ascii_digit())
}

/// Build one row, skipping header rows and fully empty lines.
fn push_row(rows: &mut Vec<ScriptRow>, row_number: u32, id: String, text: String, first: bool) {
    if first && !looks_like_id(&id) {
        // Header row (first cell does not look like a 7-digit id).
        return;
    }
    if id.is_empty() && text.is_empty() {
        return;
    }
    rows.push(ScriptRow {
        row_number,
        id,
        text,
    });
}

/// Parse a CSV/TXT file (comma separated, BOM tolerant, header sniffing).
fn import_delimited(path: &str) -> Result<Vec<ScriptRow>, BackendError> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .from_path(path)?;

    let mut rows = Vec::new();
    for (idx, record) in reader.records().enumerate() {
        let record = record?;
        let mut id = record.get(0).unwrap_or("").to_string();
        if idx == 0 {
            // Strip a UTF-8 byte order mark that survived in the first cell.
            if let Some(stripped) = id.strip_prefix('\u{feff}') {
                id = stripped.to_string();
            }
        }
        let text = record.get(1).unwrap_or("").to_string();
        push_row(&mut rows, (idx + 1) as u32, id, text, idx == 0);
    }
    Ok(rows)
}

/// Parse the first worksheet of a spreadsheet via calamine.
fn import_workbook(path: &str) -> Result<Vec<ScriptRow>, BackendError> {
    use calamine::Reader;

    let mut workbook = calamine::open_workbook_auto(path)
        .map_err(|e| BackendError::Spreadsheet(format!("Failed to open '{}': {}", path, e)))?;

    let sheet_names = workbook.sheet_names();
    let first_sheet = sheet_names
        .first()
        .cloned()
        .ok_or_else(|| BackendError::Spreadsheet(format!("'{}' has no worksheets", path)))?;

    let range = workbook.worksheet_range(&first_sheet).map_err(|e| {
        BackendError::Spreadsheet(format!("Failed to read sheet '{}': {}", first_sheet, e))
    })?;

    let mut rows = Vec::new();
    for (idx, row) in range.rows().enumerate() {
        let id = cell_to_string(row.first());
        let text = cell_to_string(row.get(1));
        push_row(&mut rows, (idx + 1) as u32, id, text, idx == 0);
    }
    Ok(rows)
}

/// Render a spreadsheet cell as its string form (numeric ids keep their
/// integer representation; leading zeros stored as text survive untouched).
fn cell_to_string(cell: Option<&calamine::Data>) -> String {
    use calamine::Data;

    match cell {
        None | Some(Data::Empty) => String::new(),
        Some(Data::String(s)) => s.clone(),
        Some(Data::Int(i)) => i.to_string(),
        Some(Data::Float(f)) => {
            if f.is_finite() && f.fract() == 0.0 && f.abs() < 1e15 {
                (*f as i64).to_string()
            } else {
                f.to_string()
            }
        }
        Some(other) => other.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_file(name: &str) -> String {
        let dir = std::env::temp_dir().join(format!(
            "audio-bench-script-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(name).to_string_lossy().into_owned()
    }

    #[test]
    fn test_csv_with_header_and_bom() {
        let path = temp_file("script.csv");
        let content = "\u{feff}id,text\n0100150,Hello world\n0100151,Second line\n";
        std::fs::write(&path, content).unwrap();

        let rows = import_delimited(&path).unwrap();
        assert_eq!(rows.len(), 2);
        // Header is row 1, first data row is row 2.
        assert_eq!(rows[0].row_number, 2);
        assert_eq!(rows[0].id, "0100150"); // leading zeros survive
        assert_eq!(rows[0].text, "Hello world");
        assert_eq!(rows[1].row_number, 3);
        assert_eq!(rows[1].id, "0100151");

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_csv_without_header() {
        let path = temp_file("script.csv");
        let content = "0100150,First\n0100151,Second\n";
        std::fs::write(&path, content).unwrap();

        let rows = import_delimited(&path).unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].row_number, 1);
        assert_eq!(rows[0].id, "0100150");
        assert_eq!(rows[1].id, "0100151");

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_unsupported_extension_is_rejected() {
        let err = import_script("/tmp/script.docx".to_string());
        assert!(err.is_err());
    }

    /// Build a minimal but valid `.xlsx` workbook in memory: one sheet with a
    /// header row plus two data rows (ids stored as text so leading zeros
    /// survive exactly like a real script export).
    fn build_xlsx() -> Vec<u8> {
        use std::io::Write;
        use zip::write::SimpleFileOptions;

        let content_types = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>"#;
        let root_rels = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>"#;
        let workbook = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Session" sheetId="1" r:id="rId1"/></sheets></workbook>"#;
        let workbook_rels = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>"#;
        let sheet = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="inlineStr"><is><t>id</t></is></c><c r="B1" t="inlineStr"><is><t>text</t></is></c></row>
<row r="2"><c r="A2" t="inlineStr"><is><t>0100150</t></is></c><c r="B2" t="inlineStr"><is><t>Hello world</t></is></c></row>
<row r="3"><c r="A3" t="inlineStr"><is><t>0100151</t></is></c><c r="B3" t="inlineStr"><is><t>Second line</t></is></c></row>
</sheetData></worksheet>"#;

        let mut cursor = std::io::Cursor::new(Vec::new());
        {
            let mut zip = zip::ZipWriter::new(&mut cursor);
            let opts = SimpleFileOptions::default();
            for (name, body) in [
                ("[Content_Types].xml", content_types),
                ("_rels/.rels", root_rels),
                ("xl/workbook.xml", workbook),
                ("xl/_rels/workbook.xml.rels", workbook_rels),
                ("xl/worksheets/sheet1.xml", sheet),
            ] {
                zip.start_file(name, opts).unwrap();
                zip.write_all(body.as_bytes()).unwrap();
            }
            zip.finish().unwrap();
        }
        cursor.into_inner()
    }

    #[test]
    fn test_xlsx_import_first_sheet_with_header() {
        let path = temp_file("script.xlsx");
        std::fs::write(&path, build_xlsx()).unwrap();

        let rows = import_workbook(&path).unwrap();
        assert_eq!(rows.len(), 2);
        // Header (row 1) skipped; first data row is sheet row 2.
        assert_eq!(rows[0].row_number, 2);
        assert_eq!(rows[0].id, "0100150");
        assert_eq!(rows[0].text, "Hello world");
        assert_eq!(rows[1].row_number, 3);
        assert_eq!(rows[1].id, "0100151");
        assert_eq!(rows[1].text, "Second line");

        // The public command routes .xlsx to the same parser.
        let via_command = import_script(path.clone()).unwrap();
        assert_eq!(via_command.len(), 2);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_looks_like_id() {
        assert!(looks_like_id("0100150"));
        assert!(!looks_like_id("id"));
        assert!(!looks_like_id("100150")); // 6 digits
        assert!(!looks_like_id("10015001")); // 8 digits
        assert!(!looks_like_id("10015a0")); // not all digits
    }
}
