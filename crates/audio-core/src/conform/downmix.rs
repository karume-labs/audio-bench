/// Downmix interleaved samples to mono by averaging all channels per frame.
///
/// For stereo this is the PRD-mandated `(L + R) / 2`. A trailing partial
/// frame (corrupt input) is dropped.
pub fn downmix_to_mono(interleaved: &[f32], channels: u16) -> Vec<f32> {
    let ch = channels as usize;
    if ch <= 1 {
        return interleaved.to_vec();
    }

    let mut mono = Vec::with_capacity(interleaved.len() / ch);
    for frame in interleaved.chunks_exact(ch) {
        let sum: f32 = frame.iter().sum();
        mono.push(sum / ch as f32);
    }
    mono
}

/// Pearson correlation between the first two channels of an interleaved
/// buffer, sampling every `frame_stride` frames to stay cheap on long files.
///
/// Returns `0.0` when there is not enough data to form a meaningful pair.
/// A value near `-1.0` means the channels are anti-correlated and a simple
/// `(L + R) / 2` downmix will cancel a large part of the signal.
pub fn stereo_correlation(interleaved: &[f32], channels: u16, frame_stride: usize) -> f32 {
    if channels < 2 || frame_stride == 0 {
        return 0.0;
    }

    let ch = channels as usize;
    let stride = frame_stride * ch;
    let mut n: f64 = 0.0;
    let mut sum_x: f64 = 0.0;
    let mut sum_y: f64 = 0.0;
    let mut sum_xx: f64 = 0.0;
    let mut sum_yy: f64 = 0.0;
    let mut sum_xy: f64 = 0.0;

    let mut i = 0;
    while i + ch <= interleaved.len() {
        let x = interleaved[i] as f64;
        let y = interleaved[i + 1] as f64;
        n += 1.0;
        sum_x += x;
        sum_y += y;
        sum_xx += x * x;
        sum_yy += y * y;
        sum_xy += x * y;
        i += stride;
    }

    if n < 8.0 {
        return 0.0;
    }

    let denom = ((n * sum_xx - sum_x * sum_x) * (n * sum_yy - sum_y * sum_y)).sqrt();
    if denom <= f64::EPSILON {
        // One (or both) channels are constant — no meaningful correlation.
        return 0.0;
    }

    let r = (n * sum_xy - sum_x * sum_y) / denom;
    r.clamp(-1.0, 1.0) as f32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_downmix_stereo() {
        let stereo = [0.5, 0.3, -0.2, 0.8, 0.1, -0.1];
        let mono = downmix_to_mono(&stereo, 2);
        assert_eq!(mono.len(), 3);
        assert!((mono[0] - 0.4).abs() < 0.001); // (0.5+0.3)/2
        assert!((mono[1] - 0.3).abs() < 0.001); // (-0.2+0.8)/2
        assert!((mono[2] - 0.0).abs() < 0.001); // (0.1+(-0.1))/2
    }

    #[test]
    fn test_downmix_mono() {
        let mono = [0.5, -0.2, 0.1];
        let result = downmix_to_mono(&mono, 1);
        assert_eq!(result, mono);
    }

    #[test]
    fn test_downmix_5_1_averages_all_channels() {
        // One 5.1 frame: six channels averaged into a single mono sample.
        let frame = [0.6f32, 0.6, 0.6, 0.6, 0.6, 0.6];
        let mono = downmix_to_mono(&frame, 6);
        assert_eq!(mono.len(), 1);
        assert!((mono[0] - 0.6).abs() < 1e-6);
    }

    #[test]
    fn test_downmix_drops_partial_trailing_frame() {
        let stereo = [1.0, 1.0, 1.0, 1.0, 0.5];
        let mono = downmix_to_mono(&stereo, 2);
        assert_eq!(mono.len(), 2);
    }

    #[test]
    fn test_correlation_identical_channels() {
        let mut buf = Vec::new();
        for i in 0..4800 {
            let v = ((i as f32 / 40.0).sin()) * 0.5;
            buf.push(v);
            buf.push(v);
        }
        let r = stereo_correlation(&buf, 2, 1);
        assert!(r > 0.99, "identical channels should correlate 1.0, got {}", r);
    }

    #[test]
    fn test_correlation_anti_correlated_channels() {
        let mut buf = Vec::new();
        for i in 0..4800 {
            let v = ((i as f32 / 40.0).sin()) * 0.5;
            buf.push(v);
            buf.push(-v);
        }
        let r = stereo_correlation(&buf, 2, 1);
        assert!(r < -0.99, "anti-correlated channels should be ~-1, got {}", r);
    }

    #[test]
    fn test_correlation_degenerate_inputs() {
        assert_eq!(stereo_correlation(&[0.0; 8], 1, 1), 0.0);
        assert_eq!(stereo_correlation(&[], 2, 1), 0.0);
        // Constant channel => no variance => no meaningful correlation.
        let mut buf = Vec::new();
        for i in 0..4800 {
            buf.push(0.5);
            buf.push((i as f32 / 40.0).sin() * 0.5);
        }
        assert_eq!(stereo_correlation(&buf, 2, 1), 0.0);
    }
}
