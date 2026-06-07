use tauri::AppHandle;
use tauri::Emitter;
use tauri_plugin_shell::ShellExt;

fn expand_tilde(path: &str) -> String {
    if path.starts_with("~/") {
        if let Some(home) = std::env::var_os("HOME") {
            return format!("{}/{}", home.to_string_lossy(), &path[2..]);
        }
    }
    path.to_string()
}

#[tauri::command]
fn open_file_location(file_path: String) -> Result<(), String> {
    let expanded = expand_tilde(&file_path);
    let path = std::path::Path::new(&expanded);
    if !path.exists() {
        return Err(format!("File not found: {}", expanded));
    }

    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .args(["-R", &expanded])
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .args(["/select,", &expanded])
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn start_download(app: AppHandle, id: String, url: String, quality: String, format: String, codec: String, save_path: String, browser: String) {
    std::thread::spawn(move || {
        let save_path = expand_tilde(&save_path);
        if let Err(e) = std::fs::create_dir_all(&save_path) {
            println!("ERROR: Failed to create save directory: {}", e);
        }
        let format_arg = if quality == "Audio only" || ["mp3", "aac", "flac", "wav"].contains(&format.to_lowercase().as_str()) {
            "bestaudio".to_string()
        } else {
            let height = quality.replace("p", "").replace("4K", "2160");
            let codec_str = match codec.as_str() {
                "H.264 (Recommended)" => "avc1",
                "H.265 / HEVC" => "hvc1",
                "AV1" => "av01",
                "VP9" => "vp09",
                _ => "",
            };
            if codec_str.is_empty() {
                format!("bestvideo[height<={}]+bestaudio/best[height<={}]", height, height)
            } else {
                format!(
                    "bestvideo[vcodec^={}][height<={}]+bestaudio/best[height<={}]/bestvideo[height<={}]+bestaudio/best[height<={}]",
                    codec_str, height, height, height, height
                )
            }
        };

        let output_template = format!("{}/%(title)s.%(ext)s", save_path);
        let sidecar = match app.shell().sidecar("yt-dlp") {
            Ok(s) => s,
            Err(e) => {
                let _ = app.emit("download-error", serde_json::json!({
                    "id": id,
                    "error": format!("Failed to find yt-dlp: {}", e)
                }));
                return;
            }
        };

        let (mut rx, _child) = match sidecar
            .args([
                "--newline",
                "--cookies-from-browser", &browser,
                "--progress",
                "--print", "after_move:%(title)s",
                "--print", "after_move:%(filepath)s",
                "-f", &format_arg,
                "--merge-output-format", &format.to_lowercase(),
                "-o", &output_template,
                &url,
            ])
            .spawn() {
                Ok(result) => result,
                Err(e) => {
                    let _ = app.emit("download-error", serde_json::json!({
                        "id": id,
                        "error": format!("Failed to start download: {}", e)
                    }));
                    return;
                }
            };

        tauri::async_runtime::block_on(async move {
            let mut video_title = String::new();
            let mut video_filepath = String::new();
            let mut stream_count = 0u32;
            let mut last_progress: u32 = 0;
            let mut printed_lines: Vec<String> = Vec::new();

            while let Some(event) = rx.recv().await {
                if let tauri_plugin_shell::process::CommandEvent::Stdout(line_bytes) = event {
                    let line = String::from_utf8_lossy(&line_bytes).to_string().trim().to_string();

                    if line.is_empty() {
                        continue;
                    }

                    if line.contains("[download] 100%") && line.contains(" in ") {
                        stream_count += 1;
                        last_progress = 0;
                    }

                    if line.contains("[download]") && line.contains('%') && !line.contains(" in ") {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if let Some(pct_str) = parts.iter().find(|s| s.ends_with('%')) {
                            let pct_clean = pct_str.replace('%', "");
                            if let Ok(pct) = pct_clean.parse::<f32>() {
                                let pct_rounded = pct.round() as u32;
                                let display_progress = if stream_count == 0 {
                                    pct_rounded / 2
                                } else {
                                    50 + pct_rounded / 2
                                };

                                if display_progress >= last_progress {
                                    last_progress = display_progress;
                                    let eta = if let Some(eta_idx) = parts.iter().position(|s| *s == "ETA") {
                                        parts.get(eta_idx + 1).unwrap_or(&"").to_string()
                                    } else {
                                        "".to_string()
                                    };
                                    let _ = app.emit("download-progress", serde_json::json!({
                                        "id": id,
                                        "progress": display_progress,
                                        "eta": eta,
                                    }));
                                }
                            }
                        }
                    }

                    // Collect non-bracket non-progress lines as --print output
                    if !line.starts_with('[') && !line.contains('%') {
                        printed_lines.push(line.clone());
                        // First print line is title, second is filepath
                        if printed_lines.len() == 1 {
                            video_title = line.clone();
                            let _ = app.emit("download-title", serde_json::json!({
                                "id": id,
                                "title": video_title,
                            }));
                        } else if printed_lines.len() == 2 {
                            video_filepath = line.clone();
                        }
                    }
                }
            }

            // Use actual filepath from yt-dlp if we got it, otherwise construct it
            let final_path = if !video_filepath.is_empty() {
                video_filepath
            } else {
                format!("{}/{}.{}", save_path, video_title, format.to_lowercase())
            };

            // If title is still empty use url as fallback
            if video_title.is_empty() {
                video_title = url.clone();
            }

            let _ = app.emit("download-complete", serde_json::json!({
                "id": id,
                "title": video_title,
                "filePath": final_path,
                "format": format,
            }));
        });
    });
}

#[tauri::command]
fn fetch_playlist(app: AppHandle, url: String, browser: String) -> Result<Vec<serde_json::Value>, String> {
    let sidecar = app.shell().sidecar("yt-dlp").map_err(|e| e.to_string())?;

    let output = tauri::async_runtime::block_on(async {
        sidecar
            .args([
                "--cookies-from-browser", &browser,
                "--flat-playlist",
                "--print", "%(title)s:::%(id)s",
                "--no-warnings",
                &url,
            ])
            .output()
            .await
    }).map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let videos: Vec<serde_json::Value> = stdout
        .lines()
        .filter(|l| l.contains(":::"))
        .map(|l| {
            let parts: Vec<&str> = l.splitn(2, ":::").collect();
            serde_json::json!({
                "title": parts.get(0).unwrap_or(&"").trim(),
                "id": parts.get(1).unwrap_or(&"").trim(),
            })
        })
        .filter(|v| {
            let title = v["title"].as_str().unwrap_or("").to_lowercase();
            !title.contains("private video") && !title.contains("deleted video")
        })
        .collect();

    Ok(videos)
}

#[tauri::command]
async fn fetch_title(app: AppHandle, url: String, browser: String) -> Result<String, String> {
    let sidecar = app.shell().sidecar("yt-dlp").map_err(|e| e.to_string())?;
    let output = sidecar
        .args([
            "--cookies-from-browser", &browser,
            "--print", "%(title)s",
            "--no-playlist",
            "--no-warnings",
            &url,
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let title = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(title)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![start_download, open_file_location, fetch_playlist, fetch_title])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
