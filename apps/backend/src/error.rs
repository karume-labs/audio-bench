use thiserror::Error;

#[derive(Error, Debug)]
pub enum BackendError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Audio core error: {0}")]
    AudioCore(#[from] audio_core::error::AudioError),
    #[error("Audio error: {0}")]
    Audio(String),
    #[error("Invalid request: {0}")]
    InvalidRequest(String),
    #[error("Project file error: {0}")]
    Json(String),
    #[error("Spreadsheet error: {0}")]
    Spreadsheet(String),
    #[error("CSV error: {0}")]
    Csv(#[from] csv::Error),
    #[error("Command error: {0}")]
    Command(String),
}

impl serde::Serialize for BackendError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
