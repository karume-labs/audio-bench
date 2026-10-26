/// High-performance audio engine for audio-bench.
/// 
/// Provides decoding, conforming, silence detection, splicing, and export window generation.
/// All audio operations happen on a normalized 48 kHz internal timeline using exact sample indices.
pub mod conform;
pub mod detect;
pub mod slice;
pub mod error;

/// Public API re-exports.
pub use conform::{
    conform_source, conform_with_warnings, decode_source, read_conformed_wav, write_conformed_wav,
    write_pcm24_wav, write_pcm16_wav, ConformResult,
};
pub use detect::envelope::AdaptiveThreshold;
pub use slice::{
    AudioSlice, ClipStatus, ClipFlag, ExportWindow, ExportWindowPlan, PeakProfile,
    apply_fade_in_out, build_export_buffer, compute_min_max_peaks, generate_peak_profiles,
    merge_silence_regions, plan_export_window, slice_audio,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lib_signatures() {
        // Verify all public functions compile and are accessible
        let _ = conform_source;
        let _ = write_conformed_wav;
        let _ = read_conformed_wav;
        let _ = AdaptiveThreshold::new(10.0, 0.0, 20.0, 1500.0, 300.0, 10000.0, 10.0);
    }
}
