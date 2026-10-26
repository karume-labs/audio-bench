//! Audio splicing: fades, export windows, waveform peak profiles.

pub mod fade;
pub mod window;

pub use fade::apply_fade_in_out;
pub use window::{compute_min_max_peaks, generate_peak_profiles, PeakProfile};

/// A slice of audio from the conformed master, with associated metadata.
///
/// All sample indices are based on the 48 kHz conformed master timeline.
#[derive(Clone, Debug, PartialEq)]
pub struct AudioSlice {
    pub start_sample: usize,
    pub end_sample: usize,
    pub script_line_id: Option<String>,
    pub status: ClipStatus,
    pub flags: Vec<ClipFlag>,
    pub text: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ClipStatus {
    Proposed,
    Approved,
    Rejected,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ClipFlag {
    DurationOutlier,
    EdgeClamped,
    SoftBeginning,
    SoftEnd,
    Exported,
}

/// Export window definition: the actual exported file spans 5s before and after the core region.
#[derive(Clone, Debug)]
pub struct ExportWindow {
    pub core_start: usize,
    pub core_end: usize,
    pub export_start: usize,
    pub export_end: usize,
    pub duration_s: f32,
}

impl ExportWindow {
    pub fn new(core_start: usize, core_end: usize, total_duration_samples: usize) -> Self {
        let pad_samples = 5usize * 48000; // 5 seconds at 48kHz

        let export_start = if core_start >= pad_samples {
            core_start - pad_samples
        } else {
            0
        };
        let export_end_raw = core_end + pad_samples;
        let effective_export_end = if export_end_raw > total_duration_samples {
            total_duration_samples
        } else {
            export_end_raw
        };

        let duration_s = (effective_export_end - export_start) as f32 / 48000.0;

        Self {
            core_start,
            core_end,
            export_start,
            export_end: effective_export_end,
            duration_s: duration_s.max(0.0),
        }
    }
    /// Core region duration in seconds (the primary sentence span, excluding pad).
    pub fn core_duration_s(&self) -> f32 {
        (self.core_end - self.core_start) as f32 / 48000.0
    }
}

impl std::fmt::Display for ExportWindow {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "ExportWindow: core[{}-{}]({:.3}s), export[{}-{}]({:.3}s)",
            self.core_start,
            self.core_end,
            (self.core_end - self.core_start) as f32 / 48000.0,
            self.export_start,
            self.export_end,
            self.duration_s
        )
    }
}

/// Planned layout of one exported clip: which master region to copy and how
/// much silence to prepend/append so the window is exactly
/// `core + pad_pre + pad_post` samples long even at the recording edges
/// (PRD §8.1 `pad_silence` edge policy).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ExportWindowPlan {
    /// First master sample to copy (inclusive).
    pub audio_start: usize,
    /// First master sample after the copied region (exclusive).
    pub audio_end: usize,
    /// Zero samples to prepend (window ran past the start of the recording).
    pub lead_deficit: usize,
    /// Zero samples to append (window ran past the end of the recording).
    pub trail_deficit: usize,
    /// Total length of the buffer produced by [`build_export_buffer`].
    pub buffer_len: usize,
}

/// Compute the export window layout for a clip (PRD §8.1, `pad_silence` policy).
///
/// ```text
/// win_start  = core_start - pad_pre        (may be negative)
/// lead_deficit = max(0, -win_start)
/// audio_start  = max(0, win_start)
/// win_end    = core_end + pad_post
/// trail_deficit = max(0, win_end - master_len)
/// audio_end    = min(master_len, win_end)
/// ```
///
/// For a core region fully inside `[0, master_len]` the resulting buffer is
/// exactly `core_len + pad_pre + pad_post` samples long.
pub fn plan_export_window(
    core_start: u64,
    core_end: u64,
    master_len: u64,
    pad_pre: u64,
    pad_post: u64,
) -> ExportWindowPlan {
    let lead_deficit = pad_pre.saturating_sub(core_start);
    let audio_start = core_start.saturating_sub(pad_pre).min(master_len);

    let win_end = core_end.saturating_add(pad_post);
    let trail_deficit = win_end.saturating_sub(master_len);
    let audio_end = win_end.min(master_len).max(audio_start);

    let copied = audio_end - audio_start;
    ExportWindowPlan {
        audio_start: audio_start as usize,
        audio_end: audio_end as usize,
        lead_deficit: lead_deficit as usize,
        trail_deficit: trail_deficit as usize,
        buffer_len: (lead_deficit + copied + trail_deficit) as usize,
    }
}

/// Materialize the export window: leading pad silence + the planned master
/// region + trailing pad silence.
pub fn build_export_buffer(master: &[f32], plan: &ExportWindowPlan) -> Vec<f32> {
    debug_assert!(plan.audio_start <= plan.audio_end);
    debug_assert!(plan.audio_end <= master.len());

    let mut out = Vec::with_capacity(plan.buffer_len);
    out.resize(plan.lead_deficit, 0.0);
    out.extend_from_slice(&master[plan.audio_start..plan.audio_end]);
    out.resize(out.len() + plan.trail_deficit, 0.0);
    out
}

/// Slice a portion of the conformed master audio.
///
/// Applies fade-in and fade-out to prevent clicks at the boundaries.
/// The fade duration is 5ms by default.
pub fn slice_audio(
    master: &[f32],
    slice: &AudioSlice,
    fade_ms: f32,
) -> Result<Vec<f32>, String> {
    let start = slice.start_sample;
    let end = slice.end_sample;

    if start >= end {
        return Err("Invalid slice: start >= end".to_string());
    }
    if end > master.len() {
        return Err("Slice extends beyond master audio".to_string());
    }

    let raw = master[start..end].to_vec();

    // Apply fades if the slice is long enough
    let min_fade_samples = (fade_ms / 1000.0 * 48000.0) as usize;
    if raw.len() > min_fade_samples * 2 {
        // Use the fade function
        let (with_fade, _) = apply_fade_in_out(&raw, min_fade_samples);
        Ok(with_fade)
    } else {
        Ok(raw) // Too short for fades, return raw
    }
}

/// Merge silence regions, removing gaps smaller than `gap` samples.
pub fn merge_silence_regions(
    regions: &mut Vec<(usize, usize)>,
    gap: usize,
) {
    if regions.is_empty() {
        return;
    }

    regions.sort_by(|a, b| a.0.cmp(&b.0));

    let mut merged: Vec<(usize, usize)> = Vec::new();
    let mut current = regions[0];

    for i in 1..regions.len() {
        let next = regions[i];
        // If the gap between current and next is within the threshold, merge
        if next.0 - current.1 <= gap {
            current = (current.0, std::cmp::max(current.1, next.1));
        } else {
            merged.push(current);
            current = next;
        }
    }
    merged.push(current);
    *regions = merged;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_export_window_basic() {
        // 10s recording: the 1000..3000 core sits inside the lead-in pad, so
        // export_start clamps to 0 and the window is core_end + 5s of pad.
        let window = ExportWindow::new(1000, 3000, 48000 * 10);
        assert!((window.duration_s - 5.0).abs() < 0.1);
        assert_eq!(window.export_start, 0);
    }

    #[test]
    fn test_export_window_clamps_to_recording_end() {
        // 1s recording cannot contain a 5s pad - window must clamp, not panic.
        let window = ExportWindow::new(1000, 3000, 48000);
        assert_eq!(window.export_end, 48000);
        assert_eq!(window.duration_s, 1.0);
    }

    #[test]
    fn test_export_window_with_padding() {
        let window = ExportWindow::new(10 * 48000, 15 * 48000, 30 * 48000);
        assert!((window.duration_s - 15.0).abs() < 0.01);
        assert!((window.core_duration_s() - 5.0).abs() < 0.01);
        assert_eq!(window.export_start, 5 * 48000);
        assert_eq!(window.export_end, 20 * 48000);
    }

    #[test]
    fn test_apply_fade_in_out() {
        let samples: Vec<f32> = vec![1.0; 100];
        let (out, peak) = apply_fade_in_out(&samples, 10);
        assert_eq!(out.len(), 100);
        assert!(peak <= 1.0);
        assert!((out[0] - 0.0).abs() < 0.5);
        assert!((out[99] - 0.0).abs() < 0.5);
    }

    #[test]
    fn test_merge_silence() {
        let mut regions = vec![(0, 100), (110, 200)];
        merge_silence_regions(&mut regions, 15);
        assert_eq!(regions.len(), 1);
        assert_eq!(regions[0], (0, 200));
    }

    const SEC: u64 = 48000;

    #[test]
    fn test_export_plan_pads_at_recording_start() {
        // 30s master, clip at 1s..2s, 5s pads: the lead window runs 4s past
        // the start of the recording, so the head deficit must be 4s of zeros.
        let master: Vec<f32> = (0..30 * SEC).map(|i| (i % 1000) as f32 / 1000.0).collect();
        let plan = plan_export_window(SEC, 2 * SEC, master.len() as u64, 5 * SEC, 5 * SEC);

        assert_eq!(plan.lead_deficit, 4 * SEC as usize);
        assert_eq!(plan.audio_start, 0);
        assert_eq!(plan.audio_end, 7 * SEC as usize);
        assert_eq!(plan.trail_deficit, 0);
        // core (1s) + 5s pre + 5s post, exactly.
        assert_eq!(plan.buffer_len, SEC as usize + 10 * SEC as usize);

        let buf = build_export_buffer(&master, &plan);
        assert_eq!(buf.len(), 528_000);
        assert!(buf[..4 * SEC as usize].iter().all(|&s| s == 0.0));
        assert_eq!(buf[4 * SEC as usize], master[0]);
        assert_eq!(buf[buf.len() - 1], master[7 * SEC as usize - 1]);
    }

    #[test]
    fn test_export_plan_pads_at_recording_end() {
        // 30s master, clip at 26s..29s: the tail window runs 4s past the end.
        let master: Vec<f32> = vec![0.25; (30 * SEC) as usize];
        let plan = plan_export_window(26 * SEC, 29 * SEC, master.len() as u64, 5 * SEC, 5 * SEC);

        assert_eq!(plan.lead_deficit, 0);
        assert_eq!(plan.audio_start, (21 * SEC) as usize);
        assert_eq!(plan.audio_end, (30 * SEC) as usize);
        assert_eq!(plan.trail_deficit, (4 * SEC) as usize);
        // core (3s) + 10s, exactly.
        assert_eq!(plan.buffer_len, 13 * SEC as usize);

        let buf = build_export_buffer(&master, &plan);
        assert_eq!(buf.len(), 13 * SEC as usize);
        assert!(buf[9 * SEC as usize..].iter().all(|&s| s == 0.0));
        assert_eq!(buf[0], 0.25);
    }

    #[test]
    fn test_export_plan_mid_recording_no_deficit() {
        // Interior clip: window fits entirely inside the master.
        let master: Vec<f32> = vec![1.0; (30 * SEC) as usize];
        let plan = plan_export_window(10 * SEC, 12 * SEC, master.len() as u64, 5 * SEC, 5 * SEC);
        assert_eq!(plan.lead_deficit, 0);
        assert_eq!(plan.trail_deficit, 0);
        assert_eq!(plan.audio_start, (5 * SEC) as usize);
        assert_eq!(plan.audio_end, (17 * SEC) as usize);
        assert_eq!(plan.buffer_len, 12 * SEC as usize);
        assert_eq!(build_export_buffer(&master, &plan).len(), 12 * SEC as usize);
    }

    #[test]
    fn test_export_plan_does_not_panic_on_out_of_range_core() {
        // Degenerate inputs must clamp rather than underflow/panic.
        let master: Vec<f32> = vec![0.5; (10 * SEC) as usize];
        let plan = plan_export_window(11 * SEC, 12 * SEC, master.len() as u64, SEC, SEC);
        let buf = build_export_buffer(&master, &plan);
        assert_eq!(buf.len(), plan.buffer_len);
    }
}
