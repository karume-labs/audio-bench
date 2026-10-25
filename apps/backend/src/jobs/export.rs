use std::path::Path;

use audio_core::slice::{apply_fade_in_out, build_export_buffer, plan_export_window};

use crate::commands::export::{ExportClip, ExportRequest, ExportResult};
use crate::error::BackendError;

/// Sample rate of the conformed master.
const SAMPLE_RATE: f64 = 48_000.0;

/// Slice the master into padded clips, then write the manifest and report.
///
/// See PRD §8.1: every exported file is `core region + pre/post window`, and
/// when the window exceeds the recording the deficit is filled with silence
/// (`pad_silence`) so each file has exactly the requested lead-in/out.
pub fn run_export(request: &ExportRequest) -> Result<ExportResult, BackendError> {
    // Reject path traversal before touching the file system.
    for clip in &request.clips {
        validate_filename(&clip.filename)?;
    }

    let out_dir = Path::new(&request.out_dir);
    std::fs::create_dir_all(out_dir)?;

    let master = audio_core::read_conformed_wav(&request.master_path).map_err(BackendError::Audio)?;
    let master_len = master.len() as u64;

    let pad_pre = to_samples(request.pre_window_s);
    let pad_post = to_samples(request.post_window_s);
    let fade_samples = to_samples(request.fade_ms / 1000.0) as usize;

    let mut clips: Vec<&ExportClip> = request.clips.iter().collect();
    clips.sort_by_key(|clip| clip.core_start_sample);

    let mut filenames: Vec<String> = Vec::with_capacity(clips.len());
    for clip in clips {
        if clip.core_end_sample <= clip.core_start_sample {
            return Err(BackendError::InvalidRequest(format!(
                "'{}' has an empty core region ({}..{})",
                clip.filename, clip.core_start_sample, clip.core_end_sample
            )));
        }
        if clip.core_start_sample > master_len {
            return Err(BackendError::InvalidRequest(format!(
                "'{}' starts beyond the end of the master",
                clip.filename
            )));
        }

        let plan = plan_export_window(
            clip.core_start_sample,
            clip.core_end_sample,
            master_len,
            pad_pre,
            pad_post,
        );
        let buffer = build_export_buffer(&master, &plan);
        // 5ms fade at the outer edges of the final buffer only.
        let (buffer, _peak) = apply_fade_in_out(&buffer, fade_samples);

        let target = out_dir.join(&clip.filename);
        audio_core::write_pcm24_wav(&buffer, &target.to_string_lossy())
            .map_err(BackendError::Audio)?;
        filenames.push(clip.filename.clone());
    }

    // The CSV content comes verbatim from the TS layer — do not reformat.
    std::fs::write(out_dir.join("manifest.csv"), request.manifest_csv.as_bytes())?;
    std::fs::write(out_dir.join("alignment_report.csv"), request.report_csv.as_bytes())?;

    Ok(ExportResult {
        written_files: filenames.len() as u32,
        out_dir: request.out_dir.clone(),
        filenames,
    })
}

fn to_samples(seconds: f64) -> u64 {
    if !seconds.is_finite() || seconds <= 0.0 {
        return 0;
    }
    (seconds * SAMPLE_RATE) as u64
}

/// Filenames are resolved by the TS naming engine; anything containing a
/// path separator or a parent-directory reference is rejected outright.
fn validate_filename(filename: &str) -> Result<(), BackendError> {
    if filename.is_empty() {
        return Err(BackendError::InvalidRequest(
            "clip filename must not be empty".to_string(),
        ));
    }
    if filename.contains('/') || filename.contains('\\') {
        return Err(BackendError::InvalidRequest(format!(
            "clip filename '{}' must not contain path separators",
            filename
        )));
    }
    if filename.contains("..") {
        return Err(BackendError::InvalidRequest(format!(
            "clip filename '{}' must not contain '..'",
            filename
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const SEC: usize = 48_000;

    struct TempDir(std::path::PathBuf);

    impl TempDir {
        fn new() -> Self {
            let dir = std::env::temp_dir().join(format!(
                "audio-bench-export-test-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            std::fs::create_dir_all(&dir).unwrap();
            Self(dir)
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn write_master(dir: &TempDir, seconds: usize) -> String {
        let path = dir.path().join("master.wav");
        let samples: Vec<f32> = vec![0.5; seconds * SEC];
        audio_core::write_pcm24_wav(&samples, &path.to_string_lossy()).unwrap();
        path.to_string_lossy().into_owned()
    }

    fn request(master: &str, out_dir: &Path, clip: ExportClip, manifest: &str, report: &str) -> ExportRequest {
        ExportRequest {
            master_path: master.to_string(),
            out_dir: out_dir.to_string_lossy().into_owned(),
            pre_window_s: 5.0,
            post_window_s: 5.0,
            fade_ms: 5.0,
            clips: vec![clip],
            manifest_csv: manifest.to_string(),
            report_csv: report.to_string(),
        }
    }

    #[test]
    fn test_export_pads_head_with_silence_and_is_exactly_core_plus_10s() {
        // 30s master, clip at 1s..2s => buffer == 1s core + 10s pads.
        let dir = TempDir::new();
        let master = write_master(&dir, 30);
        let out_dir = dir.path().join("out");

        let req = request(
            &master,
            &out_dir,
            ExportClip {
                filename: "0100150.wav".to_string(),
                core_start_sample: 1 * SEC as u64,
                core_end_sample: 2 * SEC as u64,
            },
            "\"id\",\"filename\"\n\"0100150\",\"0100150.wav\"\n",
            "report,line\n",
        );

        let result = run_export(&req).unwrap();
        assert_eq!(result.written_files, 1);
        assert_eq!(result.out_dir, out_dir.to_string_lossy().into_owned());
        assert_eq!(result.filenames, vec!["0100150.wav".to_string()]);

        let written = audio_core::read_conformed_wav(
            &out_dir.join("0100150.wav").to_string_lossy(),
        )
        .unwrap();
        // Exactly core (1s) + 5s pre + 5s post.
        assert_eq!(written.len(), SEC + 10 * SEC);

        // The window starts 4s before the recording: the head is pad silence.
        assert!(written[..4 * SEC].iter().all(|&s| s == 0.0));
        // Then the master from sample 0.
        assert!((written[4 * SEC] - 0.5).abs() < 1e-4);
        // Last sample is faded out (5ms fade at the outer edge).
        assert!(written[written.len() - 1].abs() < 1e-4);
        // Middle of the buffer is untouched audio.
        assert!((written[6 * SEC] - 0.5).abs() < 1e-4);

        // Manifest/report written verbatim.
        let manifest = std::fs::read_to_string(out_dir.join("manifest.csv")).unwrap();
        assert_eq!(manifest, "\"id\",\"filename\"\n\"0100150\",\"0100150.wav\"\n");
        let report = std::fs::read_to_string(out_dir.join("alignment_report.csv")).unwrap();
        assert_eq!(report, "report,line\n");
    }

    #[test]
    fn test_export_interior_clip_has_no_padding() {
        let dir = TempDir::new();
        let master = write_master(&dir, 30);
        let out_dir = dir.path().join("out");

        let req = request(
            &master,
            &out_dir,
            ExportClip {
                filename: "0100151.wav".to_string(),
                core_start_sample: 10 * SEC as u64,
                core_end_sample: 12 * SEC as u64,
            },
            "",
            "",
        );
        run_export(&req).unwrap();

        let written =
            audio_core::read_conformed_wav(&out_dir.join("0100151.wav").to_string_lossy())
                .unwrap();
        assert_eq!(written.len(), 2 * SEC + 10 * SEC);
        // No head deficit: audio starts right away (past the 5ms fade-in).
        assert!((written[480] - 0.5).abs() < 1e-4);
    }

    #[test]
    fn test_export_rejects_path_traversal_filenames() {
        let dir = TempDir::new();
        let master = write_master(&dir, 5);
        let out_dir = dir.path().join("out");

        for bad in [
            "../evil.wav",
            "sub/evil.wav",
            "sub\\evil.wav",
            "..",
            "",
        ] {
            let req = request(
                &master,
                &out_dir,
                ExportClip {
                    filename: bad.to_string(),
                    core_start_sample: 0,
                    core_end_sample: SEC as u64,
                },
                "",
                "",
            );
            let err = run_export(&req).expect_err("filename must be rejected");
            assert!(
                matches!(err, BackendError::InvalidRequest(_)),
                "unexpected error for {:?}: {}",
                bad,
                err
            );
        }
        assert!(!out_dir.exists(), "no files may be written for bad names");
    }

    #[test]
    fn test_export_rejects_invalid_core_regions() {
        let dir = TempDir::new();
        let master = write_master(&dir, 5);
        let out_dir = dir.path().join("out");

        // Empty core region.
        let req = request(
            &master,
            &out_dir,
            ExportClip {
                filename: "0100152.wav".to_string(),
                core_start_sample: 2 * SEC as u64,
                core_end_sample: 2 * SEC as u64,
            },
            "",
            "",
        );
        assert!(matches!(
            run_export(&req),
            Err(BackendError::InvalidRequest(_))
        ));

        // Core region starting beyond the master.
        let req = request(
            &master,
            &out_dir,
            ExportClip {
                filename: "0100153.wav".to_string(),
                core_start_sample: 10 * SEC as u64,
                core_end_sample: 11 * SEC as u64,
            },
            "",
            "",
        );
        assert!(matches!(
            run_export(&req),
            Err(BackendError::InvalidRequest(_))
        ));
    }

    #[test]
    fn test_export_clips_written_in_core_start_order() {
        let dir = TempDir::new();
        let master = write_master(&dir, 30);
        let out_dir = dir.path().join("out");

        let mk = |name: &str, start: u64, end: u64| ExportClip {
            filename: name.to_string(),
            core_start_sample: start,
            core_end_sample: end,
        };
        let mut req = request(&master, &out_dir, mk("b.wav", 10 * SEC as u64, 11 * SEC as u64), "", "");
        req.clips.push(mk("a.wav", 1 * SEC as u64, 2 * SEC as u64));

        let result = run_export(&req).unwrap();
        assert_eq!(result.filenames, vec!["a.wav".to_string(), "b.wav".to_string()]);
        assert!(out_dir.join("a.wav").exists());
        assert!(out_dir.join("b.wav").exists());
    }
}
