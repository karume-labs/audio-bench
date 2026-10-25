/// Compute frame-level energy (RMS) for an audio signal.
/// 
/// # Parameters
/// - `samples`: Interleaved f32 audio samples
/// - `frame_size`: Number of samples per frame
/// - `hop`: Number of samples between successive frame starts
/// 
/// # Returns
/// A vector of RMS energy values, one per frame. Each value is in the range [0, 1]
/// for f32 samples in the range [-1, 1].
pub fn frame_energy(samples: &[f32], frame_size: usize, hop: usize) -> Vec<f32> {
    let num_frames = if samples.len() >= frame_size {
        (samples.len() - frame_size) / hop + 1
    } else {
        0
    };

    let mut energies = Vec::with_capacity(num_frames);

    for frame_idx in 0..num_frames {
        let start = frame_idx * hop;
        let end = std::cmp::min(start + frame_size, samples.len());
        let frame = &samples[start..end];

        if frame.is_empty() {
            energies.push(0.0);
            continue;
        }

        // Compute RMS
        let mut sum_sq = 0.0f32;
        for &s in frame.iter() {
            sum_sq += s * s;
        }
        let rms = (sum_sq / frame.len() as f32).sqrt();
        energies.push(rms);
    }

    energies
}

/// Given a list of silence regions (start_sample, end_sample) in the 48kHz master timeline,
/// merge any regions that are closer than `gap` samples together.
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
    fn test_frame_energy_basic() {
        // A constant signal of 0.5 should have RMS = 0.5
        let samples: Vec<f32> = vec![0.5; 4000]; // 100ms at 48kHz
        let energies = frame_energy(&samples, 1000, 1000);
        assert_eq!(energies.len(), 4);
        assert!((energies[0] - 0.5).abs() < 0.01);
    }

    #[test]
    fn test_merge_silence() {
        let mut regions = vec![(0, 100), (110, 200)];
        merge_silence_regions(&mut regions, 15); // gap of 15, 110-100=10 <= 15, so merge
        assert_eq!(regions.len(), 1);
        assert_eq!(regions[0], (0, 200));
    }
}