use serde::{Deserialize, Serialize};

use crate::error::BackendError;
use crate::jobs;

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

/// Slice the master into padded, faded, 24-bit clips and write the manifest
/// and alignment report next to them.
#[tauri::command]
pub async fn export_clips(request: ExportRequest) -> Result<ExportResult, BackendError> {
    tauri::async_runtime::spawn_blocking(move || jobs::export::run_export(&request))
        .await
        .map_err(|e| BackendError::Command(format!("export task failed: {}", e)))?
}
