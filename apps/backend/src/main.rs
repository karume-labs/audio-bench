pub mod cache;
pub mod commands;
pub mod error;
pub mod jobs;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            commands::audio::analyze_recording,
            commands::audio::generate_peaks,
            commands::project::load_project,
            commands::project::save_project,
            commands::project::delete_project,
            commands::export::export_clips,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
