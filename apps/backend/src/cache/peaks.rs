use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::SystemTime;

use crate::error::BackendError;

/// In-memory peak cache keyed by (master path, mtime, width) so repeated UI
/// resizes do not re-read the whole master file.
static PEAK_CACHE: LazyLock<Mutex<HashMap<(String, SystemTime, u32), (Vec<f32>, Vec<f32>)>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// Return `(positive, negative)` min/max peak buckets for a master WAV.
///
/// Reads and parses the master only on a cache miss; a stale entry is
/// invalidated automatically because the modification time is part of the key.
pub fn min_max_peaks(master_path: &str, width: u32) -> Result<(Vec<f32>, Vec<f32>), BackendError> {
    if width == 0 {
        return Err(BackendError::InvalidRequest(
            "peak width must be greater than 0".to_string(),
        ));
    }

    let mtime = std::fs::metadata(master_path)?.modified()?;
    let key = (master_path.to_string(), mtime, width);

    {
        let cache = PEAK_CACHE.lock().expect("peak cache poisoned");
        if let Some(hit) = cache.get(&key) {
            return Ok(hit.clone());
        }
    }

    let samples = audio_core::read_conformed_wav(master_path).map_err(BackendError::Audio)?;
    let (positive, negative) =
        audio_core::compute_min_max_peaks(&samples, width).map_err(BackendError::Audio)?;

    let mut cache = PEAK_CACHE.lock().expect("peak cache poisoned");
    cache.insert(key, (positive.clone(), negative.clone()));

    Ok((positive, negative))
}
