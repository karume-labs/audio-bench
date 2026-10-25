use rubato::{Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction};

/// Resample audio from `input_sample_rate` to `target_rate` (e.g. 48000 Hz)
/// using rubato's windowed-sinc interpolator.
///
/// The input must be a **mono** signal (downmix first for multi-channel
/// sources). The output has exactly `round(input_len * target / input)`
/// samples; output sample 0 lines up with input sample 0 (rubato aligns the
/// filter so no manual delay compensation is needed).
pub fn resample(input: &[f32], input_rate: u32, target_rate: u32) -> Result<Vec<f32>, String> {
    if input_rate == target_rate {
        return Ok(input.to_vec());
    }
    if input.is_empty() {
        return Ok(Vec::new());
    }
    if input_rate == 0 || target_rate == 0 {
        return Err(format!(
            "invalid resample rates: {} -> {}",
            input_rate, target_rate
        ));
    }

    let ratio = target_rate as f64 / input_rate as f64;
    let expected_len = (input.len() as f64 * ratio).round() as usize;
    let chunk = std::cmp::min(1024, input.len());

    let params = SincInterpolationParameters {
        sinc_len: 128,
        f_cutoff: 0.95,
        oversampling_factor: 64,
        interpolation: SincInterpolationType::Linear,
        window: WindowFunction::BlackmanHarris2,
    };
    let mut resampler = SincFixedIn::<f32>::new(ratio, 1.1, params, chunk, 1)
        .map_err(|e| format!("Resampler construction error: {}", e))?;

    let mut out: Vec<f32> = Vec::with_capacity(expected_len + 1024);
    let mut pos = 0usize;

    while input.len() - pos >= chunk {
        let block = &input[pos..pos + chunk];
        let frames = resampler
            .process(&[block], None)
            .map_err(|e| format!("Resample error: {}", e))?;
        out.extend_from_slice(&frames[0]);
        pos += chunk;
    }

    // Process the final partial block (rubato zero-pads it internally) ...
    let tail = &input[pos..];
    let frames = resampler
        .process_partial(Some(&[tail]), None)
        .map_err(|e| format!("Resample error: {}", e))?;
    out.extend_from_slice(&frames[0]);

    // ... and flush the resampler's internal buffer.
    let frames = resampler
        .process_partial::<&[f32]>(None, None)
        .map_err(|e| format!("Resample error: {}", e))?;
    out.extend_from_slice(&frames[0]);

    // Trim (or, defensively, pad) to the exact expected output length.
    out.truncate(expected_len);
    while out.len() < expected_len {
        out.push(0.0);
    }

    Ok(out)
}

/// Resample mono audio to 48 kHz (no-op when already at 48 kHz).
pub fn resample_to_48khz(input: &[f32], input_rate: u32) -> Result<Vec<f32>, String> {
    resample(input, input_rate, 48000)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sine(seconds: f32, rate: u32, freq: f32) -> Vec<f32> {
        let n = (seconds * rate as f32) as usize;
        (0..n)
            .map(|i| (2.0 * std::f32::consts::PI * freq * i as f32 / rate as f32).sin())
            .collect()
    }

    /// Count upward zero crossings (one per tone cycle).
    fn upward_crossings(samples: &[f32]) -> usize {
        samples
            .windows(2)
            .filter(|w| w[0] <= 0.0 && w[1] > 0.0)
            .count()
    }

    #[test]
    fn test_resample_same_rate_is_identity() {
        let input: Vec<f32> = vec![1.0; 48000];
        let out = resample(&input, 48000, 48000).unwrap();
        assert_eq!(out, input);
    }

    #[test]
    fn test_resample_44100_to_48000_length_and_tone() {
        // 1s 440 Hz sine at 44.1 kHz must come back as ~48000 samples and
        // still be a 440 Hz sine at 48 kHz.
        let input = sine(1.0, 44100, 440.0);
        assert_eq!(input.len(), 44100);

        let out = resample(&input, 44100, 48000).unwrap();
        assert!(
            out.len() >= 47998 && out.len() <= 48002,
            "expected ~48000 samples, got {}",
            out.len()
        );
        assert!(out.iter().all(|s| s.is_finite()));

        // A genuine resample, not a truncation/copy of the input.
        assert_ne!(out.len(), input.len());
        assert!(out.iter().zip(input.iter()).any(|(a, b)| (a - b).abs() > 0.1));

        // The tone keeps its frequency: ~440 upward crossings per second.
        let crossings = upward_crossings(&out);
        assert!(
            (430..=450).contains(&crossings),
            "expected ~440 zero crossings, got {}",
            crossings
        );

        // ... and its phase: the first 0.1s must track the 48 kHz reference.
        let mut err = 0.0f64;
        for (k, &s) in out.iter().take(4800).enumerate() {
            let expected = (2.0 * std::f64::consts::PI * 440.0 * k as f64 / 48000.0).sin() as f32;
            err += (s - expected).abs() as f64;
        }
        assert!(
            err / 4800.0 < 0.01,
            "resampled tone deviates from reference (mean abs err {})",
            err / 4800.0
        );

        // Amplitude must survive the conversion.
        let peak = out.iter().map(|s| s.abs()).fold(0.0f32, f32::max);
        assert!(peak > 0.95, "tone amplitude collapsed, peak={}", peak);
    }

    #[test]
    fn test_resample_downsampling() {
        let input = sine(1.0, 48000, 440.0);
        let out = resample(&input, 48000, 32000).unwrap();
        assert!(
            out.len() >= 31998 && out.len() <= 32002,
            "expected ~32000 samples, got {}",
            out.len()
        );
        assert!(out.iter().all(|s| s.is_finite()));
        // Still 440 Hz after the downsample.
        let crossings = upward_crossings(&out);
        assert!(
            (430..=450).contains(&crossings),
            "expected ~440 zero crossings, got {}",
            crossings
        );
    }

    #[test]
    fn test_resample_empty_input() {
        let out = resample(&[], 44100, 48000).unwrap();
        assert!(out.is_empty());
    }
}
