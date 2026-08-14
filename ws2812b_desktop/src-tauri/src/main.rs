#![windows_subsystem = "windows"]

use reqwest::multipart;
use std::net::UdpSocket;
use std::process::Command;
use tauri::{Emitter, Manager};

// ── Window control ──
#[tauri::command]
fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}
#[tauri::command]
fn toggle_maximize_window(window: tauri::Window) -> Result<(), String> {
    if window.is_maximized().map_err(|e| e.to_string())? {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}
#[tauri::command]
fn close_app_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

// ═══════════════════════════════════════
//  UDP 实时推流
// ═══════════════════════════════════════

#[tauri::command]
fn udp_send_single(ip: String, port: u16, data_base64: String) -> Result<String, String> {
    let data = base64_to_bytes(&data_base64)?;
    if data.len() != 192 {
        return Err(format!("数据必须 192 字节, 实际 {}", data.len()));
    }

    let mut frame = vec![0u8; 200];
    frame[0] = 0x5A; frame[1] = 0xA5; // Magic
    frame[8..8 + 192].copy_from_slice(&data);

    let addr = format!("{}:{}", ip, port);
    let sock = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    sock.send_to(&frame, &addr).map_err(|e| e.to_string())?;
    Ok("sent".into())
}

#[tauri::command]
fn udp_stream_start(ip: String, port: u16) -> Result<(), String> {
    // 验证连接: 发一帧黑
    let frame = vec![0u8; 200];
    let addr = format!("{}:{}", ip, port);
    let sock = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    sock.send_to(&frame, &addr).map_err(|e| e.to_string())?;
    Ok(())
}

// ═══════════════════════════════════════
//  HTTP 控制 ESP32
// ═══════════════════════════════════════

async fn http_get(url: &str) -> Result<String, String> {
    let resp = reqwest::get(url).await.map_err(|e| e.to_string())?;
    resp.text().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn esp32_status(ip: String) -> Result<String, String> {
    http_get(&format!("http://{}/status", ip)).await
}

#[tauri::command]
async fn esp32_play(ip: String) -> Result<String, String> {
    http_get(&format!("http://{}/play", ip)).await
}

#[tauri::command]
async fn esp32_stop(ip: String) -> Result<String, String> {
    http_get(&format!("http://{}/stop", ip)).await
}

#[tauri::command]
async fn esp32_delete(ip: String) -> Result<String, String> {
    http_get(&format!("http://{}/delete", ip)).await
}

#[tauri::command]
async fn esp32_config(ip: String, key: String, value: String) -> Result<String, String> {
    http_get(&format!("http://{}/config?{}={}", ip, key, value)).await
}

#[tauri::command]
async fn esp32_upload(app: tauri::AppHandle, ip: String, file_path: String) -> Result<String, String> {
    let file_bytes = std::fs::read(&file_path).map_err(|e| e.to_string())?;
    let file_name = std::path::Path::new(&file_path)
        .file_name().unwrap_or_default()
        .to_string_lossy().to_string();

    let part = multipart::Part::bytes(file_bytes)
        .file_name(file_name)
        .mime_str("application/octet-stream")
        .map_err(|e| e.to_string())?;

    let form = multipart::Form::new().part("file", part);

    let client = reqwest::Client::new();
    let url = format!("http://{}/upload", ip);
    let _ = app.emit("upload-progress", serde_json::json!({"percent": 0, "msg": "上传中..."}));

    // 假进度: 定时发射 25/50/75%
    let app_p = app.clone();
    let progress_handle = tokio::spawn(async move {
        for pct in [25u32, 50, 75].iter() {
            tokio::time::sleep(std::time::Duration::from_millis(400)).await;
            let _ = app_p.emit("upload-progress", serde_json::json!({ "percent": pct, "msg": format!("上传中 {}%...", pct) }));
        }
    });

    let result = client.post(&url).multipart(form).send().await;
    progress_handle.abort();

    match result {
        Ok(_) => {
            let _ = app.emit("upload-progress", serde_json::json!({"percent": 100, "msg": "完成"}));
            Ok("OK".into())
        }
        Err(e) => Err(e.to_string())
    }
}

// ═══════════════════════════════════════
//  Python 子进程: 视频 → .w28
// ═══════════════════════════════════════

#[tauri::command]
async fn video_to_w28(app: tauri::AppHandle, video_path: String, output_path: String, fps: u16, mode: String) -> Result<String, String> {
    let vp = video_path.clone();
    let op = output_path.clone();
    let m = mode.clone();

    let handle = tokio::task::spawn_blocking(move || -> Result<String, String> {
        let python = find_python();
        let script = r#"
import cv2, struct, sys
from pathlib import Path

video = sys.argv[1]
out = sys.argv[2]
fps = int(sys.argv[3])
mode = sys.argv[4] if len(sys.argv) > 4 else 'binary'
is_color = (mode == 'color')

cap = cv2.VideoCapture(video)
total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
cap.release()

frames = []
cap = cv2.VideoCapture(video)
while True:
    ret, frame = cap.read()
    if not ret: break
    if is_color:
        f8 = cv2.resize(frame, (8,8), interpolation=cv2.INTER_AREA)
    else:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        f8 = cv2.resize(gray, (8,8), interpolation=cv2.INTER_AREA)
        _, f8 = cv2.threshold(f8, 128, 255, cv2.THRESH_BINARY)
    frames.append(f8)
    if len(frames) % 100 == 0:
        pct = int(len(frames) / total * 50)
        print(f"PROGRESS {len(frames)}/{total} {pct}", flush=True)
cap.release()
actual = len(frames)

def serpentine_color(f8):
    raw = bytearray(192)
    for col in range(8):
        for row in range(8):
            sr = (7-row) if col%2==1 else row
            b, g, r = f8[sr, col]
            dst = (col*8+row)*3
            raw[dst]=r; raw[dst+1]=g; raw[dst+2]=b
    return bytes(raw)

def serpentine_bw(f8):
    raw = bytearray(192)
    for col in range(8):
        for row in range(8):
            sr = (7-row) if col%2==1 else row
            v = int(f8[sr, col])
            dst = (col*8+row)*3
            raw[dst]=v; raw[dst+1]=v; raw[dst+2]=v
    return bytes(raw)

serpentine = serpentine_color if is_color else serpentine_bw

with open(out,'wb') as f:
    f.write(b'W28P'+struct.pack('<H',1)+struct.pack('<I',actual)+struct.pack('<H',fps)+struct.pack('BB',8,8)+struct.pack('<H',1 if is_color else 0))
    for i, frame in enumerate(frames):
        f.write(serpentine(frame))
        if i % 100 == 0 and i > 0:
            pct = 50 + int(i / actual * 50)
            print(f"WRITING {i}/{actual} {pct}", flush=True)

print(f"DONE {actual} {Path(out).stat().st_size}", flush=True)
"#;
        let mut child = Command::new(python)
            .args(&["-c", &script, &vp, &op, &fps.to_string(), &m])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Python 启动失败: {e}"))?;

        use std::io::{BufRead, BufReader};
        let stdout = child.stdout.take().ok_or("无法读取 stdout")?;
        let reader = BufReader::new(stdout);

        let mut frame_count: u32 = 0;
        for line in reader.lines() {
            let line = line.map_err(|e| format!("读取失败: {e}"))?;
            if line.starts_with("PROGRESS ") {
                let parts: Vec<&str> = line[9..].split_whitespace().collect();
                if parts.len() >= 3 {
                    let done: u32 = parts[0].split('/').next().unwrap_or("0").parse().unwrap_or(0);
                    let total: u32 = parts[0].split('/').nth(1).unwrap_or("1").parse().unwrap_or(1);
                    let pct: u32 = parts[2].parse().unwrap_or(0);
                    let _ = app.emit("export-progress", serde_json::json!({ "percent": pct, "msg": format!("读取帧 {}/{}", done, total) }));
                }
            } else if line.starts_with("WRITING ") {
                let parts: Vec<&str> = line[8..].split_whitespace().collect();
                if parts.len() >= 3 {
                    let done: u32 = parts[0].split('/').next().unwrap_or("0").parse().unwrap_or(0);
                    let total: u32 = parts[0].split('/').nth(1).unwrap_or("1").parse().unwrap_or(1);
                    let pct: u32 = parts[2].parse().unwrap_or(0);
                    let _ = app.emit("export-progress", serde_json::json!({ "percent": pct, "msg": format!("写入帧 {}/{}", done, total) }));
                }
            } else if line.starts_with("DONE ") {
                let parts: Vec<&str> = line[5..].split_whitespace().collect();
                if parts.len() >= 1 { frame_count = parts[0].parse().unwrap_or(0); }
                let _ = app.emit("export-progress", serde_json::json!({ "percent": 100, "msg": "完成" }));
            }
        }

        let output = child.wait().map_err(|e| format!("执行失败: {e}"))?;
        if output.success() {
            let size = std::fs::metadata(&op).map_err(|e| e.to_string())?.len();
            Ok(format!("{} 帧, {} KB", frame_count, size / 1024))
        } else {
            let mut se = child.stderr.take().unwrap();
            let mut s = String::new();
            use std::io::Read;
            se.read_to_string(&mut s).ok();
            Err(format!("Python 错误: {}", s.chars().take(200).collect::<String>()))
        }
    });

    handle.await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("读取失败: {e}"))
}

fn find_python() -> String {
    for name in &["python", "python3", "py"] {
        if Command::new(name).arg("--version").output().is_ok() {
            return name.to_string();
        }
    }
    "python".to_string()
}

fn base64_to_bytes(b64: &str) -> Result<Vec<u8>, String> {
    use std::collections::HashMap;
    let map: HashMap<char, u8> = {
        let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        chars.chars().enumerate().map(|(i, c)| (c, i as u8)).collect()
    };
    let clean: String = b64.chars().filter(|c| *c != '=' && !c.is_whitespace()).collect();
    let mut out = Vec::new();
    let mut buf: u32 = 0;
    let mut bits = 0;
    for c in clean.chars() {
        let val = map.get(&c).ok_or_else(|| format!("非法 Base64 字符: {}", c))?;
        buf = (buf << 6) | (*val as u32);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
            buf &= (1 << bits) - 1;
        }
    }
    Ok(out)
}
#[tauri::command]
fn save_pixel_w28(pixels_base64: String, output_path: String) -> Result<String, String> {
    let data = base64_to_bytes(&pixels_base64)?;
    if data.len() != 192 { return Err("192 bytes required".into()); }
    let mut f = std::fs::File::create(&output_path).map_err(|e| e.to_string())?;
    use std::io::Write;
    f.write_all(b"W28P").map_err(|e| e.to_string())?;
    f.write_all(&1u16.to_le_bytes()).map_err(|e| e.to_string())?;
    f.write_all(&1u32.to_le_bytes()).map_err(|e| e.to_string())?;
    f.write_all(&30u16.to_le_bytes()).map_err(|e| e.to_string())?;
    f.write_all(&[8, 8, 1, 0]).map_err(|e| e.to_string())?;
    f.write_all(&data).map_err(|e| e.to_string())?;
    Ok(output_path)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let window = app.get_webview_window("main").expect("no main window");
            #[cfg(target_os = "windows")]
            let _ = window_vibrancy::apply_acrylic(&window, Some((10, 10, 12, 64)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            minimize_window,
            toggle_maximize_window,
            close_app_window,
            udp_send_single,
            udp_stream_start,
            esp32_status,
            esp32_play,
            esp32_stop,
            esp32_delete,
            esp32_config,
            esp32_upload,
            video_to_w28,
            read_file_bytes,
            save_pixel_w28,
        ])
        .run(tauri::generate_context!())
        .expect("启动失败");
}
