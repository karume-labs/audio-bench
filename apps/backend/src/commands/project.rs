use serde_json::Value;

use crate::error::BackendError;

/// Load a `.audiobench` project file.
///
/// Returns `Ok(None)` when the file does not exist yet, `Err` when it exists
/// but cannot be read or is not valid JSON. Validation of the project schema
/// happens in the TypeScript domain layer.
#[tauri::command]
pub fn load_project(path: String) -> Result<Option<Value>, BackendError> {
    match std::fs::read_to_string(&path) {
        Ok(text) => {
            let value: Value = serde_json::from_str(&text).map_err(|e| {
                BackendError::Json(format!("Invalid project file '{}': {}", path, e))
            })?;
            Ok(Some(value))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(BackendError::Io(e)),
    }
}

/// Save a `.audiobench` project file as pretty-printed JSON.
///
/// The payload is passed through untouched; schema validation is done in TS.
#[tauri::command]
pub fn save_project(path: String, project: Value) -> Result<(), BackendError> {
    let json = serde_json::to_string_pretty(&project)
        .map_err(|e| BackendError::Json(format!("Failed to serialize project: {}", e)))?;
    std::fs::write(&path, json)?;
    Ok(())
}

/// Delete a project and its conformed audio files from disk.
///
/// Removes the `.audiobench` file plus the conformed master and preview
/// WAVs referenced by it (when present). Missing files are ignored.
#[tauri::command]
pub fn delete_project(path: String) -> Result<(), BackendError> {
    // Best-effort: read the project to learn which master/preview to remove.
    if let Ok(text) = std::fs::read_to_string(&path) {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
            if let Some(src) = value.get("source") {
                for key in ["master_path", "preview_path"] {
                    if let Some(p) = src.get(key).and_then(|v| v.as_str()) {
                        let _ = std::fs::remove_file(p);
                    }
                }
            }
        }
    }
    // Always attempt to remove the project file itself.
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(BackendError::Io(e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_path(name: &str) -> String {
        let dir = std::env::temp_dir().join(format!(
            "audio-bench-project-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(name).to_string_lossy().into_owned()
    }

    #[test]
    fn test_load_missing_project_is_none() {
        let path = temp_path("missing.audiobench");
        let result = load_project(path).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_save_and_load_roundtrip() {
        let path = temp_path("roundtrip.audiobench");
        let project: Value = serde_json::json!({
            "id": "2b1f0000-0000-4000-8000-000000000001",
            "name": "session",
        });

        save_project(path.clone(), project.clone()).unwrap();

        let text = std::fs::read_to_string(&path).unwrap();
        assert!(text.contains("\n  "), "expected pretty-printed JSON");
        let loaded = load_project(path.clone()).unwrap().expect("file exists");
        assert_eq!(loaded, project);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_load_invalid_json_is_err() {
        let path = temp_path("broken.audiobench");
        std::fs::write(&path, "{ not json").unwrap();
        let err = load_project(path.clone()).unwrap_err();
        assert!(matches!(err, BackendError::Json(_)));

        let _ = std::fs::remove_file(&path);
    }
}
