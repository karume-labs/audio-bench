/// Adaptive threshold estimation for silence detection.
///
/// Estimates the noise floor from the lower percentile of frame RMS values,
/// then sets the threshold a configurable margin above it.
///
/// The public fields double as the detection profile; they are readable so
/// callers can echo the active settings back to the UI.
pub struct AdaptiveThreshold {
    /// Window size in milliseconds for frame analysis
    pub frame_ms: f32,
    /// Overlap between frames in milliseconds
    pub overlap_ms: f32,
    /// Detection threshold in dB above the noise floor
    pub margin_db: f32,
    /// Minimum silence duration in milliseconds before a cut is considered
    pub min_silence_ms: f32,
    /// Minimum speech/clip duration in milliseconds (used by callers when
    /// deriving clips from the complement of the returned silence regions)
    pub min_clip_ms: f32,
    /// Maximum speech/clip duration in milliseconds (retained as detection
    /// profile metadata; silence regions are never dropped for being long —
    /// a 30s lead-in silence is still a valid cut boundary)
    pub max_clip_ms: f32,
    /// Percentile used to estimate the noise floor (e.g., 10th percentile)
    pub noise_floor_pctl: f32,
}

impl AdaptiveThreshold {
    /// Create a new adaptive threshold detector.
    ///
    /// # Parameters
    /// - `frame_ms`: Analysis frame size in ms (default: 10ms)
    /// - `overlap_ms`: Frame overlap in ms (default: 0ms)
    /// - `margin_db`: Detection threshold margin above noise floor in dB (default: 20.0)
    /// - `min_silence_ms`: Minimum silence before a cut in ms (default: 1500)
    /// - `min_clip_ms`: Minimum clip duration in ms (default: 300)
    /// - `max_clip_ms`: Maximum clip duration in ms (default: 10000)
    /// - `noise_floor_pctl`: Percentile for noise floor estimation (default: 10.0)
    pub fn new(
        frame_ms: f32,
        overlap_ms: f32,
        margin_db: f32,
        min_silence_ms: f32,
        min_clip_ms: f32,
        max_clip_ms: f32,
        noise_floor_pctl: f32,
    ) -> Self {
        Self {
            frame_ms,
            overlap_ms,
            margin_db,
            min_silence_ms,
            min_clip_ms,
            max_clip_ms,
            noise_floor_pctl,
        }
    }

    /// Detect silence regions in the audio signal.
    ///
    /// Returns **all** silence regions at least `min_silence_ms` long as
    /// `(start_sample, end_sample)` pairs on the 48 kHz master timeline.
    /// The caller derives speech regions as the complement of this list.
    ///
    /// # Algorithm
    /// 1. Split signal into overlapping frames
    /// 2. Compute RMS energy for each frame
    /// 3. Estimate noise floor from lower percentile
    /// 4. Flag frames above threshold as "speech", below as "silence"
    /// 5. Merge contiguous silence frames and keep every region that is at
    ///    least `min_silence_ms` long (no upper bound: long lead-in/trailing
    ///    silences are cut boundaries too)
    pub fn detect_silence(&self, samples: &[f32]) -> Vec<(usize, usize)> {
        if samples.is_empty() {
            return Vec::new();
        }

        // Frames are analysed on the 48 kHz timeline: convert ms -> samples.
        let frame_size = (self.frame_ms / 1000.0 * 48000.0) as usize;
        let hop_size = if self.overlap_ms > 0.0 {
            frame_size.saturating_sub((self.overlap_ms / 1000.0 * 48000.0) as usize)
        } else {
            frame_size
        };
        let frame_size = frame_size.max(1);
        let hop_size = hop_size.max(1);

        // Too short to fill a single frame (or degenerate settings): nothing
        // to analyse. This also guards the `samples.len() - frame_size`
        // subtraction below against usize underflow.
        if samples.len() < frame_size {
            return Vec::new();
        }

        // 1. Compute frame energies/RMS
        let num_frames = (samples.len() - frame_size) / hop_size + 1;
        let mut rms_values = vec![0.0f32; num_frames];

        for i in 0..num_frames {
            let frame_start = i * hop_size;
            let frame_end = std::cmp::min(frame_start + frame_size, samples.len());
            let frame_data = &samples[frame_start..frame_end];

            // Compute RMS
            let mut sum_sq = 0.0f32;
            let n = frame_data.len();
            for &s in frame_data.iter() {
                sum_sq += s * s;
            }
            if n > 0 {
                rms_values[i] = (sum_sq / n as f32).sqrt();
            }
        }

        // 2. Estimate noise floor from specified percentile
        let mut sorted_rms: Vec<f32> = rms_values.clone();
        sorted_rms.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        if sorted_rms.is_empty() {
            return Vec::new();
        }
        let pctl_idx = ((self.noise_floor_pctl / 100.0) * (sorted_rms.len() as f32))
            .max(0.0)
            .min(sorted_rms.len() as f32 - 1.0) as usize;
        let noise_floor = sorted_rms[pctl_idx];

        // 3. Compute threshold
        let threshold = noise_floor * 10.0f32.powf(self.margin_db / 20.0);

        // 4. Flag each frame as speech (> threshold) or silence (<= threshold)
        let mut speech_flags = vec![false; num_frames];
        for (i, &rms) in rms_values.iter().enumerate() {
            if rms > threshold {
                speech_flags[i] = true;
            }
        }

        // 5. Merge contiguous silence into regions.
        let min_silence_samples = (self.min_silence_ms / 1000.0 * 48000.0) as usize;
        let mut silence_regions: Vec<(usize, usize)> = Vec::new();
        let mut in_silence = false;
        let mut silence_start = 0;

        for (i, &is_speech) in speech_flags.iter().enumerate() {
            let frame_start = i * hop_size;
            let frame_end = std::cmp::min(frame_start + frame_size, samples.len());
            if !is_speech && !in_silence {
                // Start of a silence region
                in_silence = true;
                silence_start = frame_start;
            } else if is_speech && in_silence {
                // End of a silence region — keep it when it is long enough.
                // There is deliberately no upper bound here.
                let silence_duration = frame_end - silence_start;
                if silence_duration >= min_silence_samples {
                    silence_regions.push((silence_start, frame_end));
                }
                in_silence = false;
            }
        }
        // Handle silence at the end
        if in_silence {
            let silence_duration = samples.len() - silence_start;
            if silence_duration >= min_silence_samples {
                silence_regions.push((silence_start, samples.len()));
            }
        }

        silence_regions
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn detector() -> AdaptiveThreshold {
        // 10ms frames, no overlap, 20dB margin, 1500ms min silence,
        // 300ms min clip, 10s max clip, 10th-percentile noise floor.
        AdaptiveThreshold::new(10.0, 0.0, 20.0, 1500.0, 300.0, 10000.0, 10.0)
    }

    /// Build `tone1 + silence + tone2` at 48 kHz.
    fn tone_silence_tone() -> Vec<f32> {
        let tone_len = 48000 / 2; // 0.5s
        let silence_len = 48000 * 2; // 2.0s
        let mut samples = Vec::with_capacity(tone_len * 2 + silence_len);
        for i in 0..tone_len {
            samples.push((2.0 * std::f32::consts::PI * 220.0 * i as f32 / 48000.0).sin() * 0.5);
        }
        samples.extend(std::iter::repeat(0.0).take(silence_len));
        for i in 0..tone_len {
            samples.push((2.0 * std::f32::consts::PI * 220.0 * i as f32 / 48000.0).sin() * 0.5);
        }
        samples
    }

    #[test]
    fn test_threshold_creation() {
        let detector = AdaptiveThreshold::new(
            10.0,      // 10ms frames
            0.0,       // no overlap
            20.0,      // 20dB margin
            1500.0,    // 1.5min silence
            300.0,     // 300ms min clip
            10000.0,   // 10s max clip
            10.0,      // 10th percentile noise floor
        );
        assert!(detector.frame_ms == 10.0);
        assert!(detector.margin_db == 20.0);
    }

    #[test]
    fn test_detect_silence_empty() {
        let result = detector().detect_silence(&[]);
        assert!(result.is_empty());
    }

    #[test]
    fn test_detect_silence_short_input_does_not_panic() {
        // Shorter than a single 10ms frame (480 samples).
        let samples: Vec<f32> = vec![0.5; 100];
        let result = detector().detect_silence(&samples);
        assert!(result.is_empty());

        // Exactly one sample, and a completely silent short input.
        assert!(detector().detect_silence(&[0.0]).is_empty());
    }

    #[test]
    fn test_detect_silence_finds_single_gap() {
        // 0.5s tone + 2s silence + 0.5s tone, min_silence 1500ms =>
        // exactly one silence region, between the two tones.
        let samples = tone_silence_tone();
        let regions = detector().detect_silence(&samples);

        assert_eq!(regions.len(), 1, "expected exactly one region: {:?}", regions);
        let (start, end) = regions[0];
        // Starts at the first silent frame (0.5s, +/- one frame) ...
        assert!(
            (start as i64 - 24_000).abs() <= 480,
            "start {} not at 24000",
            start
        );
        // ... and ends at the first speech frame after the gap (2.5s, +/- one frame).
        assert!(
            (end as i64 - 120_000).abs() <= 480,
            "end {} not at 120000",
            end
        );
        // Longer than the 1500ms minimum silence (72000 samples).
        assert!(end - start >= 72_000);
    }

    #[test]
    fn test_detect_silence_keeps_long_lead_in() {
        // A 30s lead-in silence is far beyond the 10s "max clip" and must
        // still be returned as a cut boundary (no upper bound).
        let mut samples = vec![0.0f32; 48_000 * 30];
        for i in 0..48_000 {
            samples.push((2.0 * std::f32::consts::PI * 220.0 * i as f32 / 48000.0).sin() * 0.5);
        }

        let regions = detector().detect_silence(&samples);
        assert_eq!(regions.len(), 1, "regions: {:?}", regions);
        assert_eq!(regions[0].0, 0);
        let (start, end) = regions[0];
        assert!(end - start >= 48_000 * 30 - 480);
    }

    #[test]
    fn test_detect_silence_all_speech() {
        // Continuous tone: no silence region at all.
        let samples: Vec<f32> = (0..48_000u32)
            .map(|i| (2.0 * std::f32::consts::PI * 220.0 * i as f32 / 48000.0).sin() * 0.5)
            .collect();
        assert!(detector().detect_silence(&samples).is_empty());
    }
}
