/// Apply fade-in and fade-out to audio samples.
///
/// The fade region is clamped to at most half the buffer so the fade-in and
/// fade-out never overlap.
///
/// # Returns
/// (samples_with_fades, peak_amplitude)
pub fn apply_fade_in_out(samples: &[f32], fade_samples: usize) -> (Vec<f32>, f32) {
    let n = samples.len();
    if n == 0 {
        return (vec![], 0.0);
    }
    let mut out = samples.to_vec();

    let fade_len = std::cmp::min(fade_samples, n / 2);

    // Fade-in: gain 0 -> 1 over the first `fade_len` samples.
    for i in 0..fade_len {
        let t = i as f32 / (fade_len.max(1)) as f32;
        out[i] *= t;
    }

    // Fade-out: `i` counts backwards from the last sample, so the gain rises
    // from 0 at the very last sample up to 1.0 at the top of the fade region
    // (`t = i / (fade_len - 1)`). The naive `1.0 - t` variant is inverted and
    // leaves the final sample at full amplitude.
    for i in 0..fade_len {
        let rev_idx = n - 1 - i;
        let t = i as f32 / (fade_len - 1).max(1) as f32;
        out[rev_idx] *= t;
    }

    let peak = out.iter().map(|&s| s.abs()).fold(0.0f32, |a, b| a.max(b));

    (out, peak)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fade_in_out_basic() {
        let samples: Vec<f32> = vec![1.0; 100]; // constant 1.0
        let (out, peak) = apply_fade_in_out(&samples, 10);
        assert_eq!(out.len(), 100);
        // After fade-in+fade-out, the middle should still be ~1.0
        // and the ends should taper
        assert!((out[49] - 1.0).abs() < 0.1); // middle, should be ~1
        assert!((out[50] - 1.0).abs() < 0.1); // middle, should be ~1
        // Peak should be <= 1.0
        assert!(peak <= 1.0);
    }

    #[test]
    fn test_fade_in_out_const() {
        let samples: Vec<f32> = vec![1.0; 100];
        let (out, _) = apply_fade_in_out(&samples, 10);
        // End samples should be faded to 0
        assert!((out[0] - 0.0).abs() < 0.5); // start faded
        assert!((out[99] - 0.0).abs() < 0.5); // end faded
    }

    #[test]
    fn test_fade_out_counts_from_last_sample() {
        // The fade-out must start at 0 on the LAST sample and reach full
        // amplitude at the top of the fade region (inversion regression test).
        let samples: Vec<f32> = vec![1.0; 100];
        let (out, _) = apply_fade_in_out(&samples, 10);
        assert_eq!(out[99], 0.0); // gain 0 at the final sample
        assert_eq!(out[90], 1.0); // gain 1 at the top of the fade region
        assert!((out[95] - 4.0 / 9.0).abs() < 1e-6); // ramp between the two
        // Samples before the fade region are untouched.
        assert_eq!(out[89], 1.0);
    }

    #[test]
    fn test_fade_empty_buffer() {
        let (out, peak) = apply_fade_in_out(&[], 10);
        assert!(out.is_empty());
        assert_eq!(peak, 0.0);
    }

    #[test]
    fn test_fade_clamped_to_half_buffer() {
        // A fade longer than half the buffer must not wipe the whole signal.
        let samples: Vec<f32> = vec![1.0; 20];
        let (out, _) = apply_fade_in_out(&samples, 1000);
        assert_eq!(out.len(), 20);
        assert!(out[10] > 0.9);
    }
}
