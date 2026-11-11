//! Windows games run in a local WebAssembly canvas, inside the GameSky window.
//! The loopback server exposes only a random, session-scoped set of assets;
//! it never exposes the library directory or Tauri's IPC to the guest.
use super::{
    database, expand_home_path, extract_zip_safely, is_valid_identifier, is_windows_pe,
    safe_relative_dos_path, GameSessionEnded, PreparedGameLaunch,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File},
    io::{Cursor, Read, Write},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use tauri::{Emitter, Manager};
use tiny_http::{Header, Method, Response, Server, StatusCode};
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

const VERSION: &str = "26R1-jit-fe428d0";
const JIT_URL: &str =
    "https://boxedwine.org/builds/branches/master/builds/128/artifacts/build-128.zip";
const JIT_SOURCE: &str =
    "https://github.com/danoon2/Boxedwine/tree/fe428d02abb494229a46d5121d2f856b3f7371a6";
const URL: &str =
    "https://github.com/danoon2/Boxedwine/releases/download/26R1.0/Boxedwine26R1Web.zip";
const SHA256: &str = "ebc634e921f7c65980a7094f3efad84873cede8011eb7dd204446ff1de982945";
const ASSETS: [&str; 4] = [
    "boxedwine-shell.js",
    "boxedwine.js",
    "boxedwine.wasm",
    "boxedwine.zip",
];
const MAX_STATE: u64 = 32 * 1024 * 1024;
static INSTALL_LOCK: Mutex<()> = Mutex::new(());
static ACTIVE: Mutex<Option<ActiveGame>> = Mutex::new(None);

struct ActiveGame {
    id: i64,
    game_id: String,
    stop: Arc<AtomicBool>,
}

fn runtime_dir(data: &Path) -> PathBuf {
    data.join("windows-runtime").join(VERSION)
}
fn runtime_ready(dir: &Path) -> bool {
    ASSETS.iter().all(|name| dir.join(name).is_file())
        && dir.join("compat/boxedwine.js").is_file()
        && dir.join("compat/boxedwine.wasm").is_file()
        && dir.join("JIT-PROVENANCE.json").is_file()
}

#[tauri::command]
pub fn embedded_runtime_status(app: tauri::AppHandle) -> Result<bool, String> {
    Ok(runtime_ready(&runtime_dir(
        &app.path().app_data_dir().map_err(|e| e.to_string())?,
    )))
}

#[tauri::command]
pub fn windows_save_directory(app: tauri::AppHandle, game_id: String) -> Result<String, String> {
    if !is_valid_identifier(&game_id) {
        return Err("Invalid game id.".into());
    }
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("windows-saves")
        .join(game_id);
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn install_embedded_runtime(app: tauri::AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || install(&app))
        .await
        .map_err(|e| e.to_string())?
}

fn install(app: &tauri::AppHandle) -> Result<(), String> {
    let _lock = INSTALL_LOCK
        .try_lock()
        .map_err(|_| "The Windows engine is already being installed.".to_string())?;
    let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let destination = runtime_dir(&data);
    if runtime_ready(&destination) {
        return Ok(());
    }
    fs::create_dir_all(destination.parent().unwrap()).map_err(|e| e.to_string())?;
    let stage = tempfile::tempdir_in(destination.parent().unwrap()).map_err(|e| e.to_string())?;
    let archive_path = stage.path().join("runtime.zip");
    let client = reqwest::blocking::Client::builder()
        .connect_timeout(Duration::from_secs(30))
        .timeout(Duration::from_secs(1800))
        .build()
        .map_err(|e| e.to_string())?;
    let mut response = client
        .get(URL)
        .send()
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("Download failed: {e}"))?;
    let total = response.content_length().unwrap_or(122_244_710);
    let mut file = File::create(&archive_path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0; 64 * 1024];
    let mut downloaded = 0u64;
    let mut last = 101;
    loop {
        let n = response.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        downloaded += n as u64;
        if downloaded > 160 * 1024 * 1024 {
            return Err("Unexpected Windows engine download size.".into());
        }
        hasher.update(&buffer[..n]);
        file.write_all(&buffer[..n]).map_err(|e| e.to_string())?;
        let percent = (downloaded * 100 / total.max(1)).min(100);
        if percent != last {
            let _ = app.emit("windows-install-progress", percent);
            last = percent;
        }
    }
    drop(file);
    if format!("{:x}", hasher.finalize()) != SHA256 {
        return Err("Engine checksum verification failed. The download was discarded.".into());
    }
    let unpacked = stage.path().join("unpacked");
    extract_zip_safely(&archive_path, &unpacked)?;
    let selected = stage.path().join("selected");
    fs::create_dir(&selected).map_err(|e| e.to_string())?;
    for name in ASSETS {
        fs::copy(
            unpacked
                .join(if name == "boxedwine.zip" {
                    "Wine11"
                } else {
                    "SingleThreaded"
                })
                .join(name),
            selected.join(name),
        )
        .map_err(|e| e.to_string())?;
    }
    fs::create_dir(selected.join("compat")).map_err(|e| e.to_string())?;
    for name in ["boxedwine.js", "boxedwine.wasm"] {
        fs::copy(
            unpacked.join("SingleThreaded").join(name),
            selected.join("compat").join(name),
        )
        .map_err(|e| e.to_string())?;
    }
    for (name, offset, size, hash) in [
        (
            "boxedwine.wasm",
            42_268_062,
            1_181_698,
            "8dc9d6155373c8c261c369e706ff9a67cc7cf928009d3a63a621cbf838c1f9db",
        ),
        (
            "boxedwine.js",
            43_451_651,
            73_673,
            "480daadfccf7169c005733eb84df025c4167dc5b028716a1d0689b7d5c00177c",
        ),
    ] {
        fs::write(
            selected.join(name),
            download_jit_asset(&client, offset, size, hash)?,
        )
        .map_err(|e| e.to_string())?;
    }
    fs::write(selected.join("JIT-PROVENANCE.json"), serde_json::json!({ "source": JIT_SOURCE, "artifact": JIT_URL, "mode": "SingleThreadedJit" }).to_string()).map_err(|e| e.to_string())?;
    fs::write(selected.join("SOURCE.txt"), format!("BoxedWine (GPL-2.0-or-later), JIT build 128: {JIT_SOURCE}\nBase filesystem and compatibility core: https://github.com/danoon2/Boxedwine/tree/26R1.0\nWine 11.0 (LGPL-2.1-or-later): https://gitlab.winehq.org/wine/wine/-/tree/wine-11.0\n")).map_err(|e| e.to_string())?;
    fs::rename(selected, destination).map_err(|e| e.to_string())?;
    Ok(())
}

fn download_jit_asset(
    client: &reqwest::blocking::Client,
    offset: u64,
    compressed_size: u64,
    expected_hash: &str,
) -> Result<Vec<u8>, String> {
    let range = |start: u64, length: u64| -> Result<Vec<u8>, String> {
        let response = client
            .get(JIT_URL)
            .header("Range", format!("bytes={start}-{}", start + length - 1))
            .send()
            .and_then(|r| r.error_for_status())
            .map_err(|e| format!("JIT download failed: {e}"))?;
        if response.status() != reqwest::StatusCode::PARTIAL_CONTENT {
            return Err("The JIT server did not honor the verified byte range.".into());
        }
        let mut data = Vec::new();
        response
            .take(length + 1)
            .read_to_end(&mut data)
            .map_err(|e| e.to_string())?;
        if data.len() as u64 != length {
            return Err("The JIT download was incomplete.".into());
        }
        Ok(data)
    };
    let header = range(offset, 30)?;
    if &header[..4] != b"PK\x03\x04" || u16::from_le_bytes([header[8], header[9]]) != 8 {
        return Err("The pinned JIT archive entry has changed.".into());
    }
    let name = u16::from_le_bytes([header[26], header[27]]) as u64;
    let extra = u16::from_le_bytes([header[28], header[29]]) as u64;
    let compressed = range(offset + 30 + name + extra, compressed_size)?;
    let mut data = Vec::new();
    flate2::read::DeflateDecoder::new(&compressed[..])
        .take(16 * 1024 * 1024)
        .read_to_end(&mut data)
        .map_err(|e| e.to_string())?;
    if format!("{:x}", Sha256::digest(&data)) != expected_hash {
        return Err("JIT checksum verification failed.".into());
    }
    Ok(data)
}

fn target(game_dir: &str, working_dir: &str, executable: &str) -> Result<PathBuf, String> {
    if game_dir.trim().is_empty() || executable.trim().is_empty() {
        return Err("Choose a game folder and Windows executable.".into());
    }
    let root = expand_home_path(game_dir.trim())
        .canonicalize()
        .map_err(|_| "Game folder not found.".to_string())?;
    let work = safe_relative_dos_path(working_dir.trim(), "working directory")?;
    let exe = safe_relative_dos_path(executable.trim(), "executable")?;
    let target = root
        .join(work)
        .join(exe)
        .canonicalize()
        .map_err(|_| "Windows executable not found.".to_string())?;
    if !root.is_dir() || !target.starts_with(&root) || !target.is_file() || !is_windows_pe(&target)
    {
        return Err("Choose a Windows PE executable inside the game folder.".into());
    }
    if super::windows_pe_machine(&target) != Some(0x14c) {
        return Err("Windows executable detected, but this engine supports 32-bit x86 games. 64-bit and ARM games are not supported.".into());
    }
    Ok(target)
}

#[tauri::command]
pub fn prepare_windows_game(
    game_dir: String,
    working_dir: String,
    executable: String,
) -> Result<PreparedGameLaunch, String> {
    let exe = target(&game_dir, &working_dir, &executable)?;
    Ok(PreparedGameLaunch {
        c_drive_path: exe.parent().unwrap().to_string_lossy().into_owned(),
        working_dir: String::new(),
        executable: exe.file_name().unwrap().to_string_lossy().into_owned(),
        cd_rom_path: String::new(),
    })
}

// Profiles describe a game family, not an archive/version hash. Older builds
// receive only switches they actually advertise in their executable.
fn game_arguments(executable: &Path, language: &str) -> Result<Vec<String>, String> {
    if !executable
        .file_name()
        .is_some_and(|n| n.eq_ignore_ascii_case("east-drive.exe"))
    {
        return Ok(Vec::new());
    }
    let mut bytes = Vec::new();
    File::open(executable)
        .map_err(|e| e.to_string())?
        .take(32 * 1024 * 1024)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    let supported = |flag: &str| {
        bytes
            .windows(flag.len())
            .any(|part| part == flag.as_bytes())
    };
    let mut arguments = Vec::new();
    for (flag, value) in [
        ("--windowed", None),
        ("--scale", Some("1")),
        ("--waveout", None),
        ("--draw-distance", Some("60")),
        (
            "--language",
            Some(if language == "cs" { "cz" } else { "en" }),
        ),
    ] {
        if supported(flag) {
            arguments.push(flag.to_string());
            if let Some(value) = value {
                arguments.push(value.to_string());
            }
        }
    }
    Ok(arguments)
}

fn pack_game(dir: &Path) -> Result<Vec<u8>, String> {
    fn visit(
        zip: &mut ZipWriter<Cursor<Vec<u8>>>,
        root: &Path,
        dir: &Path,
        size: &mut u64,
        count: &mut usize,
        depth: usize,
    ) -> Result<(), String> {
        if depth > 12 {
            return Err("Game folder is nested too deeply.".into());
        }
        for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let kind = entry.file_type().map_err(|e| e.to_string())?;
            if kind.is_symlink() {
                continue;
            }
            let path = entry.path();
            if kind.is_dir() {
                visit(zip, root, &path, size, count, depth + 1)?;
            } else if kind.is_file() {
                *size += entry.metadata().map_err(|e| e.to_string())?.len();
                *count += 1;
                if *size > 512 * 1024 * 1024 || *count > 20_000 {
                    return Err(
                        "This game exceeds the embedded Windows engine's 512 MB limit.".into(),
                    );
                }
                let name = path
                    .strip_prefix(root)
                    .unwrap()
                    .to_string_lossy()
                    .replace('\\', "/");
                zip.start_file(
                    name,
                    SimpleFileOptions::default()
                        .compression_method(zip::CompressionMethod::Deflated),
                )
                .map_err(|e| e.to_string())?;
                std::io::copy(&mut File::open(path).map_err(|e| e.to_string())?, zip)
                    .map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    }
    let mut zip = ZipWriter::new(Cursor::new(Vec::new()));
    visit(&mut zip, dir, dir, &mut 0, &mut 0, 0)?;
    Ok(zip.finish().map_err(|e| e.to_string())?.into_inner())
}

fn initial_state(runtime: &Path) -> Result<Vec<u8>, String> {
    let mut root =
        ZipArchive::new(File::open(runtime.join("boxedwine.zip")).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
    let mut reg = String::new();
    root.by_name("home/username/.wine/user.reg")
        .map_err(|e| e.to_string())?
        .read_to_string(&mut reg)
        .map_err(|e| e.to_string())?;
    reg.push_str(
        "\n[Software\\\\Wine\\\\Direct3D]\n\"renderer\"=\"gdi\"\n\"DirectDrawRenderer\"=\"gdi\"\n",
    );
    let mut zip = ZipWriter::new(Cursor::new(Vec::new()));
    zip.start_file("home/username/.wine/user.reg", SimpleFileOptions::default())
        .map_err(|e| e.to_string())?;
    zip.write_all(reg.as_bytes()).map_err(|e| e.to_string())?;
    Ok(zip.finish().map_err(|e| e.to_string())?.into_inner())
}

#[derive(Deserialize)]
struct SavedFile {
    path: String,
    data: Vec<u8>,
}

fn save_state(body: &[u8], path: &Path) -> Result<(), String> {
    let files: Vec<SavedFile> = serde_json::from_slice(body).map_err(|e| e.to_string())?;
    if files.len() > 10_000 {
        return Err("Too many state files.".into());
    }
    let mut size = 0usize;
    let mut zip = ZipWriter::new(Cursor::new(Vec::new()));
    for file in files {
        let name = file.path.replace('\\', "/");
        if name.is_empty() || name.contains(':') || name.contains('\0') {
            return Err("Invalid state path.".into());
        }
        safe_relative_dos_path(&name, "state")?;
        size += file.data.len();
        if size as u64 > MAX_STATE {
            return Err("State exceeds 32 MB.".into());
        }
        zip.start_file(
            name,
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated),
        )
        .map_err(|e| e.to_string())?;
        zip.write_all(&file.data).map_err(|e| e.to_string())?;
    }
    let bytes = zip.finish().map_err(|e| e.to_string())?.into_inner();
    let mut temp =
        tempfile::NamedTempFile::new_in(path.parent().unwrap()).map_err(|e| e.to_string())?;
    temp.write_all(&bytes).map_err(|e| e.to_string())?;
    temp.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedLaunch {
    url: String,
    session_id: i64,
}

#[tauri::command]
pub async fn start_embedded_game(
    app: tauri::AppHandle,
    game_dir: String,
    working_dir: String,
    executable: String,
    game_id: String,
    language: String,
) -> Result<EmbeddedLaunch, String> {
    tauri::async_runtime::spawn_blocking(move || {
        start(app, game_dir, working_dir, executable, game_id, language)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn start(
    app: tauri::AppHandle,
    game_dir: String,
    working_dir: String,
    executable: String,
    game_id: String,
    language: String,
) -> Result<EmbeddedLaunch, String> {
    let mut active = ACTIVE.lock().map_err(|e| e.to_string())?;
    if active.is_some() {
        return Err("Close the running game before starting another.".into());
    }
    if !is_valid_identifier(&game_id) {
        return Err("Invalid game id.".into());
    }
    let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let runtime = runtime_dir(&data);
    if !runtime_ready(&runtime) {
        return Err(
            "Open Configuration → Install Windows engine first (free, open source).".into(),
        );
    }
    let executable = target(&game_dir, &working_dir, &executable)?;
    let game = pack_game(executable.parent().unwrap())?;
    let state_dir = data.join("windows-saves").join(&game_id);
    fs::create_dir_all(&state_dir).map_err(|e| e.to_string())?;
    // A .sav file is a ZIP snapshot, so the existing Save Vault can checkpoint
    // and restore it without treating unrelated game archives as saves.
    let state_path = state_dir.join("state.sav");
    if !state_path.exists() && state_dir.join("state.zip").is_file() {
        fs::rename(state_dir.join("state.zip"), &state_path).map_err(|e| e.to_string())?;
    }
    let profile = initial_state(&runtime)?;
    if !state_path.is_file() {
        fs::write(&state_path, &profile).map_err(|e| e.to_string())?;
    }
    let mut random = [0u8; 24];
    getrandom::fill(&mut random).map_err(|e| e.to_string())?;
    let token = random
        .iter()
        .map(|n| format!("{n:02x}"))
        .collect::<String>();
    let prefix = format!("/{token}/");
    let server = Server::http("127.0.0.1:0").map_err(|e| e.to_string())?;
    let origin = format!("http://{}", server.server_addr());
    let url = format!("{origin}{prefix}player.html");
    let exe_name = executable
        .file_name()
        .unwrap()
        .to_string_lossy()
        .into_owned();
    let args = game_arguments(&executable, &language)?;
    let config = serde_json::json!({ "executable": exe_name, "arguments": args });
    let id =
        database::database_start_play_session(app.clone(), game_id.clone(), "boxedwine".into())?;
    let stop = Arc::new(AtomicBool::new(false));
    *active = Some(ActiveGame {
        id,
        game_id,
        stop: stop.clone(),
    });
    drop(active);
    // A child WebView shares the existing native window. Its own isolated HTTP
    // document can use the faster threaded engine without changing the library
    // WebView's policies or breaking artwork from third-party CDNs.
    let result = (|| -> Result<(), String> {
        let window = app.get_window("main").ok_or("GameSky window not found.")?;
        let size = window
            .inner_size()
            .map_err(|e| e.to_string())?
            .to_logical::<f64>(window.scale_factor().map_err(|e| e.to_string())?);
        let builder = tauri::webview::WebviewBuilder::new(
            "embedded-game",
            tauri::WebviewUrl::External(
                url.parse()
                    .map_err(|e| format!("Invalid player URL: {e}"))?,
            ),
        )
        .auto_resize();
        let view = window
            .add_child(builder, tauri::LogicalPosition::new(0.0, 0.0), size)
            .map_err(|e| e.to_string())?;
        view.set_focus().map_err(|e| e.to_string())?;
        Ok(())
    })();
    if let Err(error) = result {
        let _ = stop_embedded_game(app.clone(), id);
        return Err(error);
    }
    let event_app = app.clone();
    std::thread::spawn(move || {
        while !stop.load(Ordering::Relaxed) {
            let Ok(Some(mut request)) = server.recv_timeout(Duration::from_millis(200)) else {
                continue;
            };
            let endpoint = request
                .url()
                .split('?')
                .next()
                .unwrap_or("")
                .strip_prefix(&prefix)
                .map(str::to_owned);
            let Some(endpoint) = endpoint else {
                let _ = request.respond(Response::empty(404));
                continue;
            };
            if request.method() == &Method::Post && endpoint == "close" {
                let allowed = request
                    .headers()
                    .iter()
                    .find(|h| h.field.equiv("Origin"))
                    .is_some_and(|h| h.value.as_str() == origin);
                if !allowed {
                    let _ = request.respond(Response::empty(403));
                    continue;
                }
                let _ = request.respond(Response::from_string("Closed"));
                let _ = stop_embedded_game(event_app.clone(), id);
                break;
            }
            if request.method() == &Method::Post && endpoint == "save" {
                let allowed = request
                    .headers()
                    .iter()
                    .find(|h| h.field.equiv("Origin"))
                    .is_some_and(|h| h.value.as_str() == origin);
                if !allowed {
                    let _ = request.respond(Response::empty(403));
                    continue;
                }
                let mut body = Vec::new();
                let result = request
                    .as_reader()
                    .take(MAX_STATE + 1)
                    .read_to_end(&mut body);
                let result = if body.len() as u64 > MAX_STATE {
                    Err("State request too large.".into())
                } else {
                    result
                        .map_err(|e| e.to_string())
                        .and_then(|_| save_state(&body, &state_path))
                };
                let (code, text) = match result {
                    Ok(()) => (200, "Saved".into()),
                    Err(e) => (400, e),
                };
                let _ =
                    request.respond(Response::from_string(text).with_status_code(StatusCode(code)));
                continue;
            }
            if request.method() != &Method::Get {
                let _ = request.respond(Response::empty(405));
                continue;
            }
            let content: Result<(Vec<u8>, &str), std::io::Error> = match endpoint.as_str() {
                "player.html" => Ok((
                    include_bytes!("embedded-player.html").to_vec(),
                    "text/html; charset=utf-8",
                )),
                "bridge.js" => Ok((
                    include_bytes!("embedded-player.js").to_vec(),
                    "application/javascript",
                )),
                "config.json" => Ok((config.to_string().into_bytes(), "application/json")),
                "game.zip" => Ok((game.clone(), "application/zip")),
                "profile.zip" => Ok((profile.clone(), "application/zip")),
                "state.zip" => fs::read(&state_path).map(|b| (b, "application/zip")),
                "compat/boxedwine.js" => fs::read(runtime.join("compat/boxedwine.js"))
                    .map(|b| (b, "application/javascript")),
                "compat/boxedwine.wasm" => {
                    fs::read(runtime.join("compat/boxedwine.wasm")).map(|b| (b, "application/wasm"))
                }
                name if ASSETS.contains(&name) => fs::read(runtime.join(name)).map(|b| {
                    (
                        b,
                        if name.ends_with(".wasm") {
                            "application/wasm"
                        } else if name.ends_with(".js") {
                            "application/javascript"
                        } else {
                            "application/zip"
                        },
                    )
                }),
                _ => {
                    let _ = request.respond(Response::empty(404));
                    continue;
                }
            };
            match content {
                Ok((bytes, mime)) => {
                    let mut response = Response::from_data(bytes);
                    for (name, value) in [
                        ("Content-Type", mime),
                        ("Cache-Control", "no-store"),
                        ("X-Content-Type-Options", "nosniff"),
                        ("Cross-Origin-Opener-Policy", "same-origin"),
                        ("Cross-Origin-Embedder-Policy", "require-corp"),
                    ] {
                        if let Ok(header) = Header::from_bytes(name, value) {
                            response.add_header(header);
                        }
                    }
                    let _ = request.respond(response);
                }
                Err(_) => {
                    let _ = request.respond(Response::empty(500));
                }
            }
        }
    });
    Ok(EmbeddedLaunch {
        url,
        session_id: id,
    })
}

#[tauri::command]
pub fn stop_embedded_game(app: tauri::AppHandle, session_id: i64) -> Result<(), String> {
    let mut active = ACTIVE.lock().map_err(|e| e.to_string())?;
    if active.as_ref().is_none_or(|s| s.id != session_id) {
        return Err("This game session is no longer running.".into());
    }
    let session = active.take().unwrap();
    session.stop.store(true, Ordering::Relaxed);
    if let Some(view) = app.get_webview("embedded-game") {
        let _ = view.close();
    }
    let duration_seconds =
        database::database_finish_play_session(app.clone(), session.id, "closed".into())?;
    let _ = app.emit(
        "game-session-ended",
        GameSessionEnded {
            game_id: session.game_id,
            session_id: session.id,
            duration_seconds,
            exit_status: "closed".into(),
        },
    );
    let _ = app.emit("embedded-player-ended", session_id);
    Ok(())
}

/// Window destruction also ends the session if the user quits the whole app.
pub fn window_closed(app: &tauri::AppHandle) {
    let Ok(mut active) = ACTIVE.lock() else {
        return;
    };
    if let Some(session) = active.take() {
        session.stop.store(true, Ordering::Relaxed);
        let _ =
            database::database_finish_play_session(app.clone(), session.id, "app-closed".into());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "network check of the pinned official JIT asset"]
    fn downloads_and_verifies_pinned_jit_asset() {
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .unwrap();
        let bytes = download_jit_asset(
            &client,
            43_451_651,
            73_673,
            "480daadfccf7169c005733eb84df025c4167dc5b028716a1d0689b7d5c00177c",
        )
        .unwrap();
        assert_eq!(bytes.len(), 325_261);
    }
    #[test]
    fn state_paths_cannot_escape_and_failed_saves_preserve_previous_state() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("state.zip");
        save_state(
            br#"[{"path":"home/username/save.dat","data":[1,2,3]}]"#,
            &path,
        )
        .unwrap();
        let original = fs::read(&path).unwrap();
        assert!(save_state(br#"[{"path":"..\\outside","data":[]}]"#, &path).is_err());
        assert_eq!(fs::read(path).unwrap(), original);
        assert!(!dir.path().join("outside").exists());
    }
    #[test]
    fn game_profiles_follow_capabilities_instead_of_version_numbers() {
        let root = tempfile::tempdir().unwrap();
        let exe = root.path().join("east-drive.exe");
        fs::write(&exe, b"an older build --windowed --language").unwrap();
        assert_eq!(
            game_arguments(&exe, "cs").unwrap(),
            ["--windowed", "--language", "cz"]
        );
        fs::write(
            &exe,
            b"a future build --windowed --scale --waveout --draw-distance --language",
        )
        .unwrap();
        assert_eq!(
            game_arguments(&exe, "en").unwrap(),
            [
                "--windowed",
                "--scale",
                "1",
                "--waveout",
                "--draw-distance",
                "60",
                "--language",
                "en"
            ]
        );
        let other = root.path().join("other-game.exe");
        fs::write(&other, b"--windowed").unwrap();
        assert!(game_arguments(&other, "en").unwrap().is_empty());
    }

    #[test]
    fn game_pack_skips_symlinks_and_preserves_relative_data() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir(dir.path().join("data")).unwrap();
        fs::write(dir.path().join("data/test.txt"), b"data").unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink("/etc/passwd", dir.path().join("external")).unwrap();
        let mut zip = ZipArchive::new(Cursor::new(pack_game(dir.path()).unwrap())).unwrap();
        assert_eq!(zip.len(), 1);
        assert_eq!(zip.by_index(0).unwrap().name(), "data/test.txt");
    }
}
