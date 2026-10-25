
/// Precomputed peak profile for a given audio slice/region.
/// Used by the UI (Wavesurfer.js) to render waveforms without loading all audio bytes.
#[derive(Clone, Debug)]
pub struct PeakProfile {
    /// Sample indices
    pub positions: Vec<usize>,
    /// Peak amplitude at each position (0.0 to 1.0)
    pub values: Vec<f32>,
    /// Zoom level: number of samples per displayed pixel
    pub zoom: usize,
}

impl PeakProfile {
    /// Create a peak profile from a sample range, decimated by the zoom factor.
    pub fn from_range(samples: &[f32], start: usize, end: usize, zoom: usize) -> Self {
        let chunk_size = std::cmp::max(1, zoom);
        let mut positions = Vec::new();
        let mut values = Vec::new();

        // Decimate: take one sample every `zoom` samples, or the max within each chunk
        let mut pos = start;
        while pos < end {
            let chunk_end = std::cmp::min(pos + chunk_size, end);
            let chunk = &samples[pos..chunk_end];
            if !chunk.is_empty() {
                let max_val = chunk.iter().map(|&s| s.abs()).fold(0.0f32, |a, b| a.max(b));
                positions.push(pos);
                values.push(max_val);
            }
            pos = chunk_end;
        }

        Self { positions, values, zoom }
    }

    /// Get the number of displayed pixels (positions)
    pub fn len(&self) -> usize {
        self.positions.len()
    }

    /// Get the value at a given pixel index
    pub fn get(&self, idx: usize) -> f32 {
        self.values[idx].min(1.0).max(0.0)
    }
}

/// Generate peak profiles at multiple zoom levels for the given audio slice.
///
/// Every profile covers the full slice; `zoom` (samples per bucket) doubles
/// per level, starting at 1 (finest) and ending at the level where a single
/// bucket spans the whole slice.
pub fn generate_peak_profiles(samples: &[f32], slice: &crate::slice::AudioSlice) -> Vec<PeakProfile> {
    let start = slice.start_sample;
    let end = slice.end_sample;
    let range = end.saturating_sub(start);

    let mut profiles = Vec::new();
    let mut zoom = 1usize;

    loop {
        profiles.push(PeakProfile::from_range(samples, start, end, zoom));
        if zoom >= range {
            break;
        }
        // Double the bucket size, capped at the slice length so the loop
        // always terminates after ~log2(range) steps.
        zoom = zoom.saturating_mul(2).min(range.max(1));
    }

    profiles
}

/// Compute per-bucket min/max peaks for waveform rendering.
///
/// The sample range is split into exactly `width` buckets
/// (bucket `i` covers `[i * n / width, (i + 1) * n / width)`).
///
/// # Returns
/// `(positive, negative)` where `positive[i]` is the maximum and
/// `negative[i]` the minimum sample value of bucket `i`, both clamped to
/// `[-1, 1]`. Empty buckets yield `(0.0, 0.0)`.
pub fn compute_min_max_peaks(samples: &[f32], width: u32) -> Result<(Vec<f32>, Vec<f32>), String> {
    if width == 0 {
        return Err("peak width must be greater than 0".to_string());
    }

    let width = width as usize;
    let n = samples.len();
    let mut positive = Vec::with_capacity(width);
    let mut negative = Vec::with_capacity(width);

    for i in 0..width {
        let start = (i * n) / width;
        let end = ((i + 1) * n) / width;
        if start >= end {
            positive.push(0.0);
            negative.push(0.0);
            continue;
        }

        let mut max = f32::MIN;
        let mut min = f32::MAX;
        for &s in &samples[start..end] {
            if s > max {
                max = s;
            }
            if s < min {
                min = s;
            }
        }
        positive.push(max.clamp(-1.0, 1.0));
        negative.push(min.clamp(-1.0, 1.0));
    }

    Ok((positive, negative))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_peak_profile_basic() {
        let samples: Vec<f32> = (0..48000).map(|i| {
            let t = i as f32 / 48000.0;
            (2.0 * std::f32::consts::PI * 5.0 * t).sin() // 5 Hz sine
        }).collect();

        let profile = PeakProfile::from_range(&samples, 0, 48000, 100);
        assert!(profile.len() > 0);
        assert!(profile.values.iter().all(|&v| v >= 0.0 && v <= 1.0));
    }

    #[test]
    fn test_generate_peak_profiles() {
        let samples: Vec<f32> = (0..48000).map(|i| {
            let t = i as f32 / 48000.0;
            (2.0 * std::f32::consts::PI * 5.0 * t).sin()
        }).collect();

        let slice = crate::slice::AudioSlice {
            start_sample: 0,
            end_sample: 48000,
            script_line_id: None,
            status: crate::slice::ClipStatus::Proposed,
            flags: Vec::new(),
            text: "test".to_string(),
        };

        let profiles = generate_peak_profiles(&samples, &slice);
        assert!(!profiles.is_empty());
    }

    #[test]
    fn test_compute_min_max_peaks_bucket_count_and_range() {
        // 1s of a 5 Hz sine at 48 kHz, rendered into 64 buckets.
        let samples: Vec<f32> = (0..48000)
            .map(|i| {
                let t = i as f32 / 48000.0;
                (2.0 * std::f32::consts::PI * 5.0 * t).sin()
            })
            .collect();

        let (positive, negative) = compute_min_max_peaks(&samples, 64).unwrap();
        assert_eq!(positive.len(), 64);
        assert_eq!(negative.len(), 64);
        for (&p, &n) in positive.iter().zip(negative.iter()) {
            assert!(p >= -1.0 && p <= 1.0);
            assert!(n >= -1.0 && n <= 1.0);
            assert!(p >= n); // max is never below min
        }
        // A full-scale sine must reach near +1 / -1 somewhere across buckets.
        assert!(positive.iter().cloned().fold(0.0f32, f32::max) > 0.99);
        assert!(negative.iter().cloned().fold(0.0f32, f32::min) < -0.99);
    }

    #[test]
    fn test_compute_min_max_peaks_known_ramp() {
        // Linear ramp from -1.0 to 0.998 in 1000 samples, 10 buckets of 100.
        let samples: Vec<f32> = (0..1000).map(|i| -1.0 + 2.0 * i as f32 / 1000.0).collect();
        let (positive, negative) = compute_min_max_peaks(&samples, 10).unwrap();
        assert_eq!(positive.len(), 10);
        assert_eq!(negative.len(), 10);
        for i in 0..10 {
            let start = i * 100;
            let end = (i + 1) * 100;
            assert!((negative[i] - samples[start]).abs() < 1e-6);
            assert!((positive[i] - samples[end - 1]).abs() < 1e-6);
        }
    }

    #[test]
    fn test_compute_min_max_peaks_empty_buckets_and_bad_width() {
        let samples: Vec<f32> = vec![0.5; 4];
        // More buckets than samples: surplus buckets are empty and read 0.0.
        let (positive, negative) = compute_min_max_peaks(&samples, 8).unwrap();
        assert_eq!(positive.len(), 8);
        assert_eq!(negative.len(), 8);
        // With 4 samples in 8 buckets, every second bucket is empty.
        assert_eq!(positive[0], 0.0);
        assert_eq!(positive[6], 0.0);
        assert_eq!(negative[6], 0.0);
        // Bucket 1 covers sample 0.
        assert!((positive[1] - 0.5).abs() < 1e-6);

        assert!(compute_min_max_peaks(&samples, 0).is_err());
    }
}