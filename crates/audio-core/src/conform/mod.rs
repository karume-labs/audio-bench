//! Conforming: decode -> downmix -> resample -> 24-bit/48 kHz mono master.

pub mod decode;
pub mod downmix;
pub mod resample;

pub use decode::{decode_source, decode_wav_to_f32, decode_with_symphonia};
pub use downmix::{downmix_to_mono, stereo_correlation};
pub use resample::{resample, resample_to_48khz};

/// Target sample rate of the internal timeline.
pub const MASTER_SAMPLE_RATE: u32 = 48000;

/// Full-scale divisor used when writing 24-bit PCM. Mirrors the read scale in
/// [`decode::decode_wav_to_f32`] so the write/read roundtrip is symmetric.
const PCM24_SCALE: f32 = 8_388_607.0;

/// Result of conforming a source file to the internal standard.
#[derive(Clone, Debug)]
pub struct ConformResult {
    /// Mono samples on the 48 kHz timeline, clamped to `[-1, 1]`.
    pub samples: Vec<f32>,
    /// Always `48000`.
    pub sample_rate: u32,
    /// Duration of `samples` in seconds.
    pub duration_s: f64,
    /// Non-fatal issues found while conforming (e.g. anti-correlated
    /// channels, post-resample peaks above full scale).
    pub warnings: Vec<String>,
}

/// Conform a source audio file to the internal standard:
/// - decode (WAV via hound, other containers via Symphonia)
/// - downmix to mono (averaged channels)
/// - resample to 48 kHz
/// - clamp to `[-1, 1]`
///
/// Returns `(conformed_samples, sample_rate, duration_secs)`; use
/// [`conform_with_warnings`] to also collect warnings.
pub fn conform_source(path: &str) -> Result<(Vec<f32>, u32, f32), String> {
    let result = conform_with_warnings(path)?;
    Ok((result.samples, result.sample_rate, result.duration_s as f32))
}

/// Like [`conform_source`] but also reports warnings:
/// - strongly anti-correlated stereo channels (downmix cancellation)
/// - post-resample peaks above full scale (PRD §4: reported, never lowered
///   silently — the master is clamped to valid PCM on write).
pub fn conform_with_warnings(path: &str) -> Result<ConformResult, String> {
    // 1. Decode to interleaved f32.
    let (interleaved, channels, sr) = decode_source(path)?;
    if interleaved.is_empty() {
        return Err(format!("'{}' contains no audio", path));
    }

    let mut warnings = Vec::new();

    // 2. Downmix to mono if needed, warning when the channels cancel.
    if channels >= 2 {
        let corr = stereo_correlation(&interleaved, channels, 100);
        if corr < -0.5 {
            warnings.push(format!(
                "Left/right channels are strongly anti-correlated (r = {:.2}); \
                 the (L+R)/2 downmix may cancel significant content.",
                corr
            ));
        }
    }
    let mono = downmix_to_mono(&interleaved, channels);

    // 3. Resample to 48 kHz.
    let resampled = resample_to_48khz(&mono, sr)?;

    // 4. Report (then clamp) anything above full scale after resampling.
    let mut peak: f32 = 0.0;
    for &s in resampled.iter() {
        let a = s.abs();
        if a > peak {
            peak = a;
        }
    }
    if peak > 1.0 {
        warnings.push(format!(
            "Post-resample peak {:.2} dBFS exceeds full scale; samples were clamped to 0 dBFS.",
            20.0 * peak.log10()
        ));
    }
    let clipped: Vec<f32> = resampled.iter().map(|&s| s.clamp(-1.0, 1.0)).collect();

    let duration_s = clipped.len() as f64 / MASTER_SAMPLE_RATE as f64;

    Ok(ConformResult {
        samples: clipped,
        sample_rate: MASTER_SAMPLE_RATE,
        duration_s,
        warnings,
    })
}

/// Write f32 samples as a true 24-bit PCM WAV (mono, 48 kHz).
///
/// Samples are scaled with `round(s.clamp(-1, 1) * 8_388_607)` and stored as
/// little-endian signed 24-bit integers (`SampleFormat::Int`).
pub fn write_pcm24_wav(samples: &[f32], path: &str) -> Result<(), String> {
    use hound::SampleFormat;

    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: MASTER_SAMPLE_RATE,
        bits_per_sample: 24,
        sample_format: SampleFormat::Int,
    };

    let mut writer =
        hound::WavWriter::create(path, spec).map_err(|e| format!("WAV create error: {}", e))?;

    for &s in samples.iter() {
        let q = (s.clamp(-1.0, 1.0) * PCM24_SCALE).round() as i32;
        writer.write_sample(q).map_err(|e| format!("WAV write error: {}", e))?;
    }

    writer.finalize().map_err(|e| format!("WAV finalize error: {}", e))?;
    Ok(())
}

/// Write conformed f32 samples as a 24-bit PCM WAV file.
pub fn write_conformed_wav(samples: &[f32], path: &str) -> Result<(), String> {
    write_pcm24_wav(samples, path)
}

/// Read a (conformed master) WAV file back as mono f32 samples.
///
/// Handles 8/16/24/32-bit integer PCM as well as float WAVs; multi-channel
/// files are downmixed to mono.
pub fn read_conformed_wav(path: &str) -> Result<Vec<f32>, String> {
    let (samples, channels, _sample_rate) = decode_wav_to_f32(path)?;
    Ok(downmix_to_mono(&samples, channels))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_path(name: &str) -> String {
        let dir = std::env::temp_dir().join(format!("audio-core-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(name).to_string_lossy().into_owned()
    }

    #[test]
    fn test_downmix_to_mono() {
        let stereo = [0.5, 0.3, -0.2, 0.8];
        let mono = downmix_to_mono(&stereo, 2);
        assert_eq!(mono.len(), 2);
        assert!((mono[0] - 0.4).abs() < 0.01);
        assert!((mono[1] - 0.3).abs() < 0.01);
    }

    #[test]
    fn test_downmix_mono() {
        let mono = [0.5, -0.2, 0.1];
        let result = downmix_to_mono(&mono, 1);
        assert_eq!(result, mono);
    }

    #[test]
    fn test_resample_same_rate() {
        let input: Vec<f32> = vec![1.0; 48000];
        let result = resample_to_48khz(&input, 48000);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), input);
    }

    #[test]
    fn test_conform_source_signature() {
        let _ = conform_source;
        let _ = conform_with_warnings;
        let _ = write_pcm24_wav;
    }

    #[test]
    fn test_write_read_pcm24_roundtrip() {
        // A known ramp written as 24-bit PCM must come back within 1/2^23.
        let path = temp_path("roundtrip.wav");
        let ramp: Vec<f32> = (0..1001).map(|i| -1.0 + 2.0 * i as f32 / 1000.0).collect();

        write_pcm24_wav(&ramp, &path).unwrap();
        let back = read_conformed_wav(&path).unwrap();

        assert_eq!(back.len(), ramp.len());
        let tol = 1.0 / 8_388_608.0; // 1/2^23
        for (i, (&a, &b)) in ramp.iter().zip(back.iter()).enumerate() {
            assert!(
                (a - b).abs() <= tol,
                "sample {}: {} vs {} (diff {} > {})",
                i,
                a,
                b,
                (a - b).abs(),
                tol
            );
        }

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_read_conformed_wav_reports_int24_spec() {
        let path = temp_path("spec.wav");
        let samples: Vec<f32> = vec![0.0, 0.5, -0.5, 1.0, -1.0];
        write_pcm24_wav(&samples, &path).unwrap();

        let reader = hound::WavReader::open(&path).unwrap();
        assert_eq!(reader.spec().sample_format, hound::SampleFormat::Int);
        assert_eq!(reader.spec().bits_per_sample, 24);
        assert_eq!(reader.spec().sample_rate, 48000);
        assert_eq!(reader.spec().channels, 1);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_decode_wav_integer_pcm() {
        // 16-bit PCM WAV decoded and scaled to [-1, 1].
        let path = temp_path("pcm16.wav");
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 44100,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer = hound::WavWriter::create(&path, spec).unwrap();
        writer.write_sample(0i16).unwrap();
        writer.write_sample(i16::MAX).unwrap();
        writer.write_sample(i16::MIN).unwrap();
        writer.finalize().unwrap();

        let (samples, channels, rate) = decode_wav_to_f32(&path).unwrap();
        assert_eq!(channels, 1);
        assert_eq!(rate, 44100);
        assert_eq!(samples.len(), 3);
        assert_eq!(samples[0], 0.0);
        assert!((samples[1] - 32767.0 / 32768.0).abs() < 1e-6);
        assert!((samples[2] + 1.0).abs() < 1e-6);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_conform_writes_master_and_reports_anticorrelation() {
        // Stereo source whose channels are exact mirrors => anti-correlated.
        let path = temp_path("anti.wav");
        let spec = hound::WavSpec {
            channels: 2,
            sample_rate: 48000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer = hound::WavWriter::create(&path, spec).unwrap();
        for i in 0..48_000u32 {
            let v = ((i as f32 / 40.0).sin() * 8000.0) as i16;
            writer.write_sample(v).unwrap();
            writer.write_sample(-v).unwrap();
        }
        writer.finalize().unwrap();

        let result = conform_with_warnings(&path).unwrap();
        assert_eq!(result.sample_rate, 48000);
        assert_eq!(result.samples.len(), 48_000);
        assert!(
            result.warnings.iter().any(|w| w.contains("anti-correlated")),
            "expected anti-correlation warning, got {:?}",
            result.warnings
        );
        // Perfectly mirrored channels downmix to silence.
        let peak = result.samples.iter().map(|s| s.abs()).fold(0.0f32, f32::max);
        assert!(peak < 1e-3);

        let _ = std::fs::remove_file(&path);
    }
}
