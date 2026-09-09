#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![ffmpeg_available, ffmpeg_transcode])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[tauri::command]
fn ffmpeg_available() -> bool {
  std::process::Command::new("ffmpeg")
    .arg("-version")
    .stdout(std::process::Stdio::null())
    .stderr(std::process::Stdio::null())
    .status()
    .map(|s| s.success())
    .unwrap_or(false)
}

#[tauri::command]
fn ffmpeg_transcode(src: String, dst: String) -> Result<(), String> {
  let output = std::process::Command::new("ffmpeg")
    .args([
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      &src,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      &dst,
    ])
    .output()
    .map_err(|e| format!("无法启动 ffmpeg（请安装并加入 PATH）：{e}"))?;
  if !output.status.success() {
    let err = String::from_utf8_lossy(&output.stderr);
    let msg = err.trim();
    return Err(if msg.is_empty() {
      "ffmpeg 转码失败".into()
    } else {
      msg.to_string()
    });
  }
  Ok(())
}
