use std::path::{Path, PathBuf};

use tauri::Emitter;

use crate::commands::audio::{AnalysisResult, DetectedClip, DetectionSettings, SourceInfo};
use crate::error::BackendError;

/// The conformed master always lives next to the source as
/// `<stem>.master.wav`.
pub fn master_path_for(source_path: &str) -> PathBuf {
    let source = Path::new(source_path);
    let stem = source
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("audio");
    let mut master = source.to_path_buf();
    master.set_file_name(format!("{}.master.wav", stem));
    master
}

fn emit_progress(app: &tauri::AppHandle, phase: &str, pct: f32, message: &str) {
    let _ = app.emit(
        "analysis-progress",
        AnalysisProgress {
            phase: phase.to_string(),
            pct,
            message: message.to_string(),
        },
    );
}

/// Payload of the `analysis-progress` event.
#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisProgress {
    pub phase: String,
    pub pct: f32,
    pub message: String,
}

/// The heavy analysis pipeline: conform (or reuse the master) -> detect
/// silence -> derive clips. Runs on a blocking worker thread.
pub fn run_analysis(
    app: tauri::AppHandle,
    source_path: &str,
    settings: &DetectionSettings,
) -> Result<AnalysisResult, BackendError> {
    let source_meta = std::fs::metadata(source_path)?;
    if !source_meta.is_file() {
        return Err(BackendError::InvalidRequest(format!(
            "'{}' is not a file",
            source_path
        )));
    }
    let source_mtime = source_meta.modified()?;

    let master_path = master_path_for(source_path);
    let master_str = master_path.to_string_lossy().into_owned();

    // Reuse an existing master when it is at least as new as the source.
    let up_to_date = std::fs::metadata(&master_path)
        .and_then(|m| m.modified())
        .map(|mtime| mtime >= source_mtime)
        .unwrap_or(false);

    let mut warnings: Vec<String> = Vec::new();
    if up_to_date {
        emit_progress(&app, "conform", 45.0, "Reusing existing conformed master");
    } else {
        emit_progress(
            &app,
            "conform",
            10.0,
            "Conforming source to 24-bit / 48 kHz mono…",
        );
        let conformed =
            audio_core::conform_with_warnings(source_path).map_err(BackendError::Audio)?;
        warnings = conformed.warnings;
        audio_core::write_pcm24_wav(&conformed.samples, &master_str)
            .map_err(BackendError::Audio)?;
        emit_progress(&app, "conform", 45.0, "Conformed master written");
    }

    emit_progress(&app, "detect", 50.0, "Reading conformed master…");
    let master = audio_core::read_conformed_wav(&master_str).map_err(BackendError::Audio)?;
    let duration_samples = master.len() as u64;

    emit_progress(&app, "detect", 65.0, "Detecting silence…");
    let (silence, resolved_min_silence_ms) = match settings.min_silence_ms {
        Some(v) => {
            let detector = audio_core::AdaptiveThreshold::new(
                settings.frame_ms,
                settings.overlap_ms,
                settings.margin_db,
                v,
                settings.min_clip_ms,
                settings.max_clip_ms,
                settings.noise_floor_pctl,
            );
            (detector.detect_silence(&master), v)
        }
        None => {
            let detector = audio_core::AdaptiveThreshold::new(
                settings.frame_ms,
                settings.overlap_ms,
                settings.margin_db,
                1500.0,
                settings.min_clip_ms,
                settings.max_clip_ms,
                settings.noise_floor_pctl,
            );
            detector.detect_silence_auto(&master)
        }
    };

    emit_progress(&app, "detect", 90.0, "Deriving clip boundaries…");
    let clips = derive_clips(&silence, duration_samples, settings);

    emit_progress(
        &app,
        "done",
        100.0,
        &format!("Detected {} clip(s)", clips.len()),
    );

    Ok(AnalysisResult {
        source: SourceInfo {
            original_path: source_path.to_string(),
            master_path: master_str,
            duration_samples,
            duration_seconds: duration_samples as f64 / 48_000.0,
            sample_rate: 48_000,
            channels: 1,
            warnings,
        },
        clips,
        min_silence_ms: resolved_min_silence_ms,
    })
}

/// Derive core regions as the complement of the detected silence regions,
/// padded with the guard window (PRD §5.1) and filtered by `min_clip_ms`.
fn derive_clips(
    silence: &[(usize, usize)],
    duration_samples: u64,
    settings: &DetectionSettings,
) -> Vec<DetectedClip> {
    let n = duration_samples;
    let guard = (settings.guard_ms.max(0.0) / 1000.0 * 48_000.0) as u64;
    let min_clip = (settings.min_clip_ms.max(0.0) / 1000.0 * 48_000.0) as u64;

    // Complement of the silence regions on [0, n).
    let mut speech: Vec<(u64, u64)> = Vec::new();
    let mut cursor = 0u64;
    for &(start, end) in silence {
        let start = (start as u64).min(n);
        let end = (end as u64).min(n);
        if start > cursor {
            speech.push((cursor, start));
        }
        cursor = cursor.max(end);
    }
    if cursor < n {
        speech.push((cursor, n));
    }

    let mut clips = Vec::with_capacity(speech.len());
    for (start, end) in speech {
        if end.saturating_sub(start) < min_clip {
            // Shorter than the minimum clip: noise blip, not a line.
            continue;
        }
        let clamped_start = start.saturating_sub(guard);
        let clamped_end = end.saturating_add(guard).min(n);
        let edge_clamped = start < guard || end.saturating_add(guard) > n;
        clips.push(DetectedClip {
            start_sample: clamped_start,
            end_sample: clamped_end,
            edge_clamped,
        });
    }
    clips
}

#[cfg(test)]
mod tests {
    use super::*;

    fn settings() -> DetectionSettings {
        DetectionSettings::default()
    }

    #[test]
    fn test_master_path_naming() {
        assert_eq!(
            master_path_for("/tmp/session/take1.wav").to_string_lossy(),
            "/tmp/session/take1.master.wav"
        );
        assert_eq!(
            master_path_for("/tmp/session/take1.flac").to_string_lossy(),
            "/tmp/session/take1.master.wav"
        );
    }

    #[test]
    fn test_derive_clips_complement_of_silence() {
        // 10s master: speech 0..2s, silence 2..8s, speech 8..10s.
        let n = 10 * 48_000u64;
        let silence = vec![(2 * 48_000, 8 * 48_000)];
        let clips = derive_clips(&silence, n, &settings());
        assert_eq!(clips.len(), 2);

        // First clip: core starts at 0 (guard clamped) => edge_clamped.
        assert_eq!(clips[0].start_sample, 0);
        assert_eq!(clips[0].end_sample, 2 * 48_000 + 4800); // 2s + 100ms guard
        assert!(clips[0].edge_clamped);

        // Second clip ends exactly at the master end => edge_clamped.
        assert_eq!(clips[1].start_sample, 8 * 48_000 - 4800);
        assert_eq!(clips[1].end_sample, n);
        assert!(clips[1].edge_clamped);
    }

    #[test]
    fn test_derive_clips_interior_clip_not_edge_clamped() {
        // 20s master with leading and trailing silence: the interior speech
        // region gets the full guard on both sides.
        let n = 20 * 48_000u64;
        let silence = vec![(0, 5 * 48_000), (15 * 48_000, n as usize)];
        let clips = derive_clips(&silence, n, &settings());
        assert_eq!(clips.len(), 1);
        assert_eq!(clips[0].start_sample, 5 * 48_000 - 4800);
        assert_eq!(clips[0].end_sample, 15 * 48_000 + 4800);
        assert!(!clips[0].edge_clamped);
    }

    #[test]
    fn test_derive_clips_drops_sub_min_clip_regions() {
        // A 100ms blip (below the 300ms minimum clip) is not a clip.
        let n = 10 * 48_000u64;
        let silence = vec![
            (0, 4 * 48_000),
            (4 * 48_000 + 4_800, n as usize), // 100ms of "speech" at 4s
        ];
        let clips = derive_clips(&silence, n, &settings());
        assert!(clips.is_empty(), "expected no clips, got {:?}", clips);
    }

    #[test]
    fn test_derive_clips_no_silence_yields_single_clip() {
        let n = 48_000u64;
        let clips = derive_clips(&[], n, &settings());
        assert_eq!(clips.len(), 1);
        assert_eq!(clips[0].start_sample, 0);
        assert_eq!(clips[0].end_sample, n);
        assert!(clips[0].edge_clamped);
    }
}
