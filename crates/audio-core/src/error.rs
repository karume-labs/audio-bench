use thiserror::Error;

#[derive(Error, Debug)]
pub enum AudioError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Decode error: {0}")]
    Decode(String),
    #[error("Resample error: {0}")]
    Resample(String),
    #[error("Hound WAV error: {0}")]
    Wav(#[from] hound::Error),
    #[error("Invalid audio format: {0}")]
    InvalidFormat(String),
}
