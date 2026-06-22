use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

struct ServerProcess(Mutex<Option<Child>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let server_dir = app
                .path()
                .resource_dir()
                .unwrap_or_default()
                .join("..\\..\\server");

            // In dev, resolve relative to the project
            let working_dir = if cfg!(debug_assertions) {
                std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..\\server")
            } else {
                server_dir
            };

            log::info!("Starting YouStudio server from {:?}", working_dir);

            let child = Command::new("bun")
                .arg("run")
                .arg("src/index.ts")
                .current_dir(&working_dir)
                .spawn();

            match child {
                Ok(process) => {
                    log::info!("YouStudio server started (pid: {})", process.id());
                    app.manage(ServerProcess(Mutex::new(Some(process))));
                }
                Err(e) => {
                    log::error!("Failed to start YouStudio server: {}", e);
                    app.manage(ServerProcess(Mutex::new(None)));
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(state) = window.try_state::<ServerProcess>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(ref mut child) = *guard {
                            log::info!("Shutting down YouStudio server (pid: {})", child.id());
                            let _ = child.kill();
                            let _ = child.wait();
                        }
                        *guard = None;
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running YouStudio");
}
