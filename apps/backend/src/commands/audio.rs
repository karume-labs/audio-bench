use serde::{Deserialize, Serialize};

use crate::cache;
use crate::error::BackendError;
use crate::jobs;

/// Detection profile for the silence detector. Every field has a serde
/// default, so `settings: null`/absent means "all defaults".
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DetectionSettings {
    /// Analysis frame size in ms.
    pub frame_ms: f32,
    /// Frame overlap in ms.
    pub overlap_ms: f32,
    /// Threshold margin above the estimated noise floor, in dB.
    pub margin_db: f32,
    /// Minimum silence length (ms) that becomes a cut boundary.
    /// `None` means "auto-tune from the recording".
    #[serde(default)]
    pub min_silence_ms: Option<f32>,
    /// Minimum clip length (ms) when deriving clips from speech regions.
    pub min_clip_ms: f32,
    /// Maximum clip length (ms); detection profile metadata.
    pub max_clip_ms: f32,
    /// Percentile used to estimate the noise floor.
    pub noise_floor_pctl: f32,
    /// Guard padding (ms) added around each speech region.
    pub guard_ms: f32,
}

impl Default for DetectionSettings {
    fn default() -> Self {
        Self {
            frame_ms: 10.0,
            overlap_ms: 0.0,
            margin_db: 20.0,
            min_silence_ms: None,
            min_clip_ms: 300.0,
            max_clip_ms: 10000.0,
            noise_floor_pctl: 10.0,
            guard_ms: 100.0,
        }
    }
}

/// Metadata about the conformed source handed back to the UI.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceInfo {
    pub original_path: String,
    pub master_path: String,
    pub preview_path: String,
    pub duration_samples: u64,
    pub duration_seconds: f64,
    pub sample_rate: u32,
    pub channels: u16,
    pub warnings: Vec<String>,
}

/// One detected core region on the 48 kHz master timeline.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedClip {
    pub start_sample: u64,
    pub end_sample: u64,
    /// True when the guard padding was clamped by a recording edge.
    pub edge_clamped: bool,
}

/// Result of `analyze_recording`.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisResult {
    pub source: SourceInfo,
    pub clips: Vec<DetectedClip>,
    /// Resolved minimum-silence value actually used (ms).
    pub min_silence_ms: f32,
}

/// Result of `generate_peaks`: min/max waveform buckets over `width` pixels.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Peaks {
    pub width: u32,
    pub positive: Vec<f32>,
    pub negative: Vec<f32>,
}

/// Conform the recording (reusing an up-to-date master when possible), run
/// silence detection and derive clips. Heavy work runs on a blocking thread
/// and reports progress via the `analysis-progress` event.
#[tauri::command]
pub async fn analyze_recording(
    app: tauri::AppHandle,
    path: String,
    settings: Option<DetectionSettings>,
) -> Result<AnalysisResult, BackendError> {
    let settings = settings.unwrap_or_default();

    tauri::async_runtime::spawn_blocking(move || {
        jobs::analysis::run_analysis(app, &path, &settings)
    })
    .await
    .map_err(|e| BackendError::Command(format!("analysis task failed: {}", e)))?
}

/// Compute min/max waveform peaks for a master file, with an in-memory cache
/// keyed by (path, mtime, width).
#[tauri::command]
pub async fn generate_peaks(
    master_path: String,
    width: u32,
) -> Result<Peaks, BackendError> {
    tauri::async_runtime::spawn_blocking(move || {
        let (positive, negative) = cache::peaks::min_max_peaks(&master_path, width)?;
        Ok(Peaks {
            width,
            positive,
            negative,
        })
    })
    .await
    .map_err(|e| BackendError::Command(format!("peaks task failed: {}", e)))?
}
