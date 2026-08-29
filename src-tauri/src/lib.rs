use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;
use tauri::{Emitter, Manager};
use tauri_plugin_updater::UpdaterExt;
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

mod database;

#[derive(Serialize, Deserialize, Debug)]
pub struct LaunchResult {
    pub success: bool,
    pub message: String,
    #[serde(rename = "commandExecuted")]
    pub command_executed: Option<String>,
    #[serde(rename = "confGenerated")]
    pub conf_generated: Option<String>,
    #[serde(rename = "sessionId")]
    pub session_id: Option<i64>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct GameSessionEnded {
    game_id: String,
    session_id: i64,
    duration_seconds: i64,
    exit_status: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DosboxInstallation {
    pub name: String,
    pub path: String,
    #[serde(rename = "emulatorType")]
    pub emulator_type: String,
    pub exists: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PreparedGameLaunch {
    #[serde(rename = "cDrivePath")]
    pub c_drive_path: String,
    #[serde(rename = "workingDir")]
    pub working_dir: String,
    pub executable: String,
    #[serde(rename = "cdRomPath")]
    pub cd_rom_path: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DiscoveredGame {
    pub title: String,
    #[serde(rename = "targetFolder")]
    pub target_folder: String,
    #[serde(rename = "workingDir")]
    pub working_dir: String,
    pub executable: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DownloadGameResult {
    pub success: bool,
    pub installed: bool,
    pub message: String,
    #[serde(rename = "targetFolder")]
    pub target_folder: String,
    pub executable: String,
    #[serde(rename = "workingDir")]
    pub working_dir: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SaveFileInfo {
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "relativePath")]
    pub relative_path: String,
    #[serde(rename = "sizeBytes")]
    pub size_bytes: u64,
    #[serde(rename = "modifiedTimestamp")]
    pub modified_timestamp: u64,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SaveBackupInfo {
    pub id: String,
    pub name: String,
    #[serde(rename = "folderPath")]
    pub folder_path: String,
    pub timestamp: u64,
    #[serde(rename = "fileCount")]
    pub file_count: usize,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct MediaPathRequest {
    pub path: String,
    pub kind: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ExecutableCandidate {
    pub executable: String,
    #[serde(rename = "workingDir")]
    pub working_dir: String,
    #[serde(rename = "absolutePath")]
    pub absolute_path: String,
    pub score: i32,
    pub role: String,
    pub reason: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DiagnosticItem {
    pub id: String,
    pub status: String,
    pub label: String,
    pub message: String,
    #[serde(rename = "repairAction")]
    pub repair_action: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LibraryBackupPayload {
    pub games_json: String,
    pub preferences_json: String,
    pub source_path: String,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AvailableUpdate {
    pub available: bool,
    pub version: Option<String>,
    pub notes: Option<String>,
}

fn configured_updater(app: &tauri::AppHandle) -> Result<tauri_plugin_updater::Updater, String> {
    let public_key = option_env!("GAMESKY_UPDATER_PUBKEY")
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Updater public key was not embedded in this build".to_string())?;
    let endpoint = "https://gamesky.space/releases/latest.json"
        .parse()
        .map_err(|error| format!("Invalid update endpoint: {error}"))?;
    app.updater_builder()
        .pubkey(public_key)
        .target("macos-universal")
        .endpoints(vec![endpoint])
        .map_err(|error| format!("Failed to configure updater endpoint: {error}"))?
        .build()
        .map_err(|error| format!("Failed to initialize updater: {error}"))
}

#[tauri::command]
async fn check_for_update(app: tauri::AppHandle) -> Result<AvailableUpdate, String> {
    let update = configured_updater(&app)?
        .check()
        .await
        .map_err(|error| format!("Update check failed: {error}"))?;
    Ok(match update {
        Some(update) => AvailableUpdate {
            available: true,
            version: Some(update.version),
            notes: update.body,
        },
        None => AvailableUpdate {
            available: false,
            version: None,
            notes: None,
        },
    })
}

#[tauri::command]
async fn install_available_update(app: tauri::AppHandle) -> Result<(), String> {
    let Some(update) = configured_updater(&app)?
        .check()
        .await
        .map_err(|error| format!("Update check failed: {error}"))?
    else {
        return Err("No update is currently available".to_string());
    };
    let progress_app = app.clone();
    update
        .download_and_install(
            move |chunk, total| {
                let _ = progress_app.emit(
                    "updater-progress",
                    serde_json::json!({
                        "chunkBytes": chunk,
                        "totalBytes": total
                    }),
                );
            },
            || {},
        )
        .await
        .map_err(|error| format!("Update installation failed: {error}"))?;
    app.restart();
}

#[tauri::command]
fn pick_file_native(title: Option<String>, extensions: Vec<String>) -> Option<String> {
    let mut dialog = rfd::FileDialog::new();
    if let Some(t) = title {
        dialog = dialog.set_title(&t);
    }
    if !extensions.is_empty() {
        let exts_str: Vec<&str> = extensions.iter().map(|s| s.as_str()).collect();
        dialog = dialog.add_filter("Supported Files", &exts_str);
    }

    dialog.pick_file().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn pick_files_native(title: Option<String>, extensions: Vec<String>) -> Vec<String> {
    let mut dialog = rfd::FileDialog::new();
    if let Some(t) = title {
        dialog = dialog.set_title(&t);
    }
    if !extensions.is_empty() {
        let exts_str: Vec<&str> = extensions.iter().map(|s| s.as_str()).collect();
        dialog = dialog.add_filter("Supported Files", &exts_str);
    }
    dialog
        .pick_files()
        .unwrap_or_default()
        .into_iter()
        .map(|path| path.to_string_lossy().to_string())
        .collect()
}

#[tauri::command]
fn pick_folder_native(title: Option<String>) -> Option<String> {
    let mut dialog = rfd::FileDialog::new();
    if let Some(t) = title {
        dialog = dialog.set_title(&t);
    }

    dialog
        .pick_folder()
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn export_library_backup(
    games_json: String,
    preferences_json: String,
) -> Result<Option<String>, String> {
    let games: serde_json::Value = serde_json::from_str(&games_json)
        .map_err(|error| format!("Game library is not valid JSON: {error}"))?;
    if !games.is_array() {
        return Err("Game library backup must contain an array".to_string());
    }
    let preferences: serde_json::Value = serde_json::from_str(&preferences_json)
        .map_err(|error| format!("Preferences are not valid JSON: {error}"))?;
    let Some(path) = rfd::FileDialog::new()
        .set_title("Export GameSky.space backup")
        .set_file_name("GameSky-space-backup.gsky")
        .add_filter("GameSky.space Backup", &["gsky"])
        .save_file()
    else {
        return Ok(None);
    };

    let file = File::create(&path).map_err(|error| format!("Failed to create backup: {error}"))?;
    let mut archive = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o600);
    let manifest = serde_json::json!({
        "format": "gamesky-space-portable-backup",
        "version": 1,
        "createdAt": std::time::SystemTime::now().duration_since(UNIX_EPOCH).map(|value| value.as_millis()).unwrap_or(0),
        "containsGameFiles": false,
        "note": "Profiles, settings and media references only; owned game files stay in their original folders."
    });
    archive
        .start_file("manifest.json", options)
        .map_err(|error| format!("Failed to create backup manifest: {error}"))?;
    archive
        .write_all(
            serde_json::to_string_pretty(&manifest)
                .map_err(|error| error.to_string())?
                .as_bytes(),
        )
        .map_err(|error| format!("Failed to write backup manifest: {error}"))?;
    archive
        .start_file("library.json", options)
        .map_err(|error| format!("Failed to create library backup: {error}"))?;
    archive
        .write_all(
            serde_json::to_string_pretty(&games)
                .map_err(|error| error.to_string())?
                .as_bytes(),
        )
        .map_err(|error| format!("Failed to write library backup: {error}"))?;
    archive
        .start_file("preferences.json", options)
        .map_err(|error| format!("Failed to create preferences backup: {error}"))?;
    archive
        .write_all(
            serde_json::to_string_pretty(&preferences)
                .map_err(|error| error.to_string())?
                .as_bytes(),
        )
        .map_err(|error| format!("Failed to write preferences backup: {error}"))?;
    archive
        .finish()
        .map_err(|error| format!("Failed to finish backup: {error}"))?;
    Ok(Some(path.to_string_lossy().to_string()))
}

#[tauri::command]
fn import_library_backup() -> Result<Option<LibraryBackupPayload>, String> {
    let Some(path) = rfd::FileDialog::new()
        .set_title("Import GameSky.space backup")
        .add_filter("GameSky.space Backup", &["gsky"])
        .pick_file()
    else {
        return Ok(None);
    };
    let metadata =
        fs::metadata(&path).map_err(|error| format!("Failed to inspect backup: {error}"))?;
    if metadata.len() > 64 * 1024 * 1024 {
        return Err("Backup is larger than the 64 MiB safety limit".to_string());
    }
    let file = File::open(&path).map_err(|error| format!("Failed to open backup: {error}"))?;
    let mut archive =
        ZipArchive::new(file).map_err(|error| format!("Invalid GameSky.space backup: {error}"))?;
    let read_entry = |archive: &mut ZipArchive<File>, name: &str| -> Result<String, String> {
        let mut entry = archive
            .by_name(name)
            .map_err(|_| format!("Backup is missing {name}"))?;
        if entry.size() > 32 * 1024 * 1024 {
            return Err(format!("Backup entry {name} is too large"));
        }
        let mut value = String::new();
        entry
            .read_to_string(&mut value)
            .map_err(|error| format!("Failed to read {name}: {error}"))?;
        Ok(value)
    };
    let games_json = read_entry(&mut archive, "library.json")?;
    let preferences_json = read_entry(&mut archive, "preferences.json")?;
    let games: serde_json::Value = serde_json::from_str(&games_json)
        .map_err(|error| format!("Backup library JSON is invalid: {error}"))?;
    if !games.is_array() {
        return Err("Backup library is not an array".to_string());
    }
    serde_json::from_str::<serde_json::Value>(&preferences_json)
        .map_err(|error| format!("Backup preferences JSON is invalid: {error}"))?;
    Ok(Some(LibraryBackupPayload {
        games_json,
        preferences_json,
        source_path: path.to_string_lossy().to_string(),
    }))
}

#[tauri::command]
fn save_mapper_profile(
    app: tauri::AppHandle,
    game_id: String,
    content: String,
) -> Result<String, String> {
    if game_id.is_empty()
        || game_id.len() > 160
        || !game_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '_' | '-'))
    {
        return Err("Invalid game id for mapper profile".to_string());
    }
    if content.len() > 256 * 1024 || content.contains('\0') {
        return Err("Mapper profile is invalid or too large".to_string());
    }
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve mapper folder: {error}"))?
        .join("mappers");
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Failed to create mapper folder: {error}"))?;
    let path = directory.join(format!("{game_id}.map"));
    fs::write(&path, content).map_err(|error| format!("Failed to save mapper profile: {error}"))?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn scan_game_saves(game_dir: String) -> Result<Vec<SaveFileInfo>, String> {
    let path = Path::new(&game_dir);
    if !path.exists() || !path.is_dir() {
        return Ok(Vec::new());
    }

    let save_extensions = [
        "sav", "dsg", "wl6", "wl1", "gam", "dat", "svr", "sc2", "cty", "d2", "ck4", "ck5", "ck6",
        "ck1", "cfg", "ini", "scr", "sta",
    ];

    let mut results = Vec::new();
    fn visit_save_files(
        base: &Path,
        directory: &Path,
        depth: usize,
        extensions: &[&str],
        results: &mut Vec<SaveFileInfo>,
    ) {
        if depth > 12 {
            return;
        }
        let Ok(entries) = fs::read_dir(directory) else {
            return;
        };
        for entry in entries.flatten() {
            let file_path = entry.path();
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                visit_save_files(base, &file_path, depth + 1, extensions, results);
            } else if file_type.is_file() {
                let file_name = file_path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                let file_name_lower = file_name.to_lowercase();

                let is_save = extensions
                    .iter()
                    .any(|ext| file_name_lower.ends_with(&format!(".{ext}")))
                    || file_name_lower.starts_with("save")
                    || file_name_lower.starts_with("game")
                    || file_name_lower.contains("save");

                if is_save {
                    let metadata = entry.metadata().ok();
                    let size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                    let modified_timestamp = metadata
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);

                    results.push(SaveFileInfo {
                        file_name: file_name.to_string(),
                        file_path: file_path.to_string_lossy().to_string(),
                        relative_path: file_path
                            .strip_prefix(base)
                            .unwrap_or(&file_path)
                            .to_string_lossy()
                            .to_string(),
                        size_bytes,
                        modified_timestamp,
                    });
                }
            }
        }
    }
    visit_save_files(path, path, 0, &save_extensions, &mut results);

    results.sort_by(|a, b| b.modified_timestamp.cmp(&a.modified_timestamp));
    Ok(results)
}

fn saves_root() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join("DOSGAMES_SAVES")
}

fn validated_game_vault(game_id: &str) -> Result<PathBuf, String> {
    if game_id.is_empty()
        || game_id.len() > 160
        || !game_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-'))
    {
        return Err("Invalid game id".to_string());
    }
    Ok(saves_root().join(game_id))
}

fn validate_checkpoint_folder(game_id: &str, checkpoint_folder: &str) -> Result<PathBuf, String> {
    let vault = validated_game_vault(game_id)?;
    let canonical_vault = vault
        .canonicalize()
        .map_err(|_| "The save vault does not exist".to_string())?;
    let canonical_checkpoint = Path::new(checkpoint_folder)
        .canonicalize()
        .map_err(|_| "The checkpoint folder does not exist".to_string())?;
    if canonical_checkpoint.parent() != Some(canonical_vault.as_path()) {
        return Err("Checkpoint folder is outside this game's save vault".to_string());
    }
    Ok(canonical_checkpoint)
}

#[tauri::command]
fn create_save_backup(
    game_id: String,
    game_dir: String,
    backup_name: String,
) -> Result<SaveBackupInfo, String> {
    let saves_vault = validated_game_vault(&game_id)?;
    let now = std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let safe_name = backup_name
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-' || *c == ' ')
        .collect::<String>()
        .trim()
        .replace(' ', "_");

    let snapshot_id = format!(
        "{}_{}",
        now,
        if safe_name.is_empty() {
            "checkpoint"
        } else {
            &safe_name
        }
    );
    let backup_dir = saves_vault.join(&snapshot_id);
    fs::create_dir_all(&backup_dir).map_err(|e| format!("Failed to create backup dir: {}", e))?;

    // Find and copy saves
    let saves = scan_game_saves(game_dir)?;
    let mut copied_count = 0;

    for save in &saves {
        let src = Path::new(&save.file_path);
        let dest = backup_dir.join(&save.relative_path);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create backup subdirectory: {e}"))?;
        }
        if fs::copy(src, dest).is_ok() {
            copied_count += 1;
        }
    }

    // Write metadata file
    let meta_content = format!(
        "name={}\ntimestamp={}\ncount={}\n",
        backup_name, now, copied_count
    );
    let _ = fs::write(backup_dir.join("checkpoint.info"), meta_content);

    Ok(SaveBackupInfo {
        id: snapshot_id,
        name: backup_name,
        folder_path: backup_dir.to_string_lossy().to_string(),
        timestamp: now,
        file_count: copied_count,
    })
}

#[tauri::command]
fn list_save_backups(game_id: String) -> Result<Vec<SaveBackupInfo>, String> {
    let saves_vault = validated_game_vault(&game_id)?;

    fn count_checkpoint_files(directory: &Path, depth: usize) -> usize {
        if depth > 12 {
            return 0;
        }
        let Ok(entries) = fs::read_dir(directory) else {
            return 0;
        };
        entries
            .flatten()
            .map(|entry| {
                let path = entry.path();
                if path.is_dir() {
                    count_checkpoint_files(&path, depth + 1)
                } else if path.file_name().and_then(|name| name.to_str()) == Some("checkpoint.info")
                {
                    0
                } else {
                    1
                }
            })
            .sum()
    }

    if !saves_vault.exists() {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();
    if let Ok(entries) = fs::read_dir(saves_vault) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let id = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                let mut name = id.clone();
                let mut timestamp = 0;
                let mut file_count = 0;

                // Read checkpoint.info if present
                let info_file = path.join("checkpoint.info");
                if let Ok(info_str) = fs::read_to_string(info_file) {
                    for line in info_str.lines() {
                        if let Some(val) = line.strip_prefix("name=") {
                            name = val.to_string();
                        } else if let Some(val) = line.strip_prefix("timestamp=") {
                            timestamp = val.parse::<u64>().unwrap_or(0);
                        } else if let Some(val) = line.strip_prefix("count=") {
                            file_count = val.parse::<usize>().unwrap_or(0);
                        }
                    }
                }

                if file_count == 0 {
                    file_count = count_checkpoint_files(&path, 0);
                }

                results.push(SaveBackupInfo {
                    id,
                    name,
                    folder_path: path.to_string_lossy().to_string(),
                    timestamp,
                    file_count,
                });
            }
        }
    }

    results.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(results)
}

#[tauri::command]
fn restore_save_backup(
    game_id: String,
    game_dir: String,
    backup_folder: String,
) -> Result<bool, String> {
    let src_dir = validate_checkpoint_folder(&game_id, &backup_folder)?;
    let target_dir = Path::new(&game_dir);

    if !target_dir.exists() || !target_dir.is_dir() {
        return Err("Source backup or target game folder does not exist".to_string());
    }

    fn restore_files(
        backup_root: &Path,
        directory: &Path,
        target_root: &Path,
        depth: usize,
    ) -> Result<(), String> {
        if depth > 12 {
            return Err("Checkpoint directory nesting is too deep".to_string());
        }
        let entries =
            fs::read_dir(directory).map_err(|e| format!("Failed to read backup directory: {e}"))?;
        for entry in entries.flatten() {
            let source = entry.path();
            let file_type = entry
                .file_type()
                .map_err(|e| format!("Failed to inspect checkpoint file: {e}"))?;
            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                restore_files(backup_root, &source, target_root, depth + 1)?;
            } else if file_type.is_file()
                && source.file_name().and_then(|name| name.to_str()) != Some("checkpoint.info")
            {
                let relative = source
                    .strip_prefix(backup_root)
                    .map_err(|_| "Invalid checkpoint path".to_string())?;
                let destination = target_root.join(relative);
                if let Some(parent) = destination.parent() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("Failed to create restore directory: {e}"))?;
                }
                fs::copy(&source, &destination).map_err(|e| {
                    format!("Failed to restore '{}': {e}", relative.to_string_lossy())
                })?;
            }
        }
        Ok(())
    }
    restore_files(&src_dir, &src_dir, target_dir, 0)?;

    Ok(true)
}

#[tauri::command]
fn delete_save_backup(game_id: String, backup_folder: String) -> Result<bool, String> {
    let path = validate_checkpoint_folder(&game_id, &backup_folder)?;
    fs::remove_dir_all(path).map_err(|e| format!("Failed to delete backup folder: {}", e))?;
    Ok(true)
}

#[tauri::command]
fn open_folder_in_finder(folder_path: String) -> Result<bool, String> {
    let path = Path::new(&folder_path);
    if !path.exists() || !path.is_dir() {
        return Err("Folder does not exist".to_string());
    }
    #[cfg(target_os = "macos")]
    let result = Command::new("open").arg(&folder_path).spawn();
    #[cfg(target_os = "windows")]
    let result = Command::new("explorer").arg(&folder_path).spawn();
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let result = Command::new("xdg-open").arg(&folder_path).spawn();
    result.map_err(|e| format!("Failed to open folder: {e}"))?;
    Ok(true)
}

fn is_allowed_artwork_url(value: &str) -> bool {
    let Ok(url) = reqwest::Url::parse(value) else {
        return false;
    };
    if url.scheme() != "https" {
        return false;
    }
    match url.host_str() {
        Some("thumbnails.libretro.com") => url.path().starts_with("/DOS/Named_Boxarts/"),
        Some("archive.org") => url.path().starts_with("/services/img/"),
        Some(host) if host.ends_with(".archive.org") => true,
        _ => false,
    }
}

fn cache_artwork_blocking(
    app: tauri::AppHandle,
    game_id: String,
    source_url: String,
) -> Result<String, String> {
    if !is_valid_identifier(&game_id) || !is_allowed_artwork_url(&source_url) {
        return Err("Artwork source is not approved".to_string());
    }
    let client = reqwest::blocking::Client::builder()
        .user_agent("GameSky.space/1.0 (+https://gamesky.space)")
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() < 5 && is_allowed_artwork_url(attempt.url().as_str()) {
                attempt.follow()
            } else {
                attempt.stop()
            }
        }))
        .build()
        .map_err(|error| format!("Failed to initialize artwork client: {error}"))?;
    let response = client
        .get(&source_url)
        .send()
        .and_then(reqwest::blocking::Response::error_for_status)
        .map_err(|error| format!("Failed to download artwork: {error}"))?;
    const MAX_ARTWORK_SIZE: u64 = 8 * 1024 * 1024;
    if response
        .content_length()
        .is_some_and(|size| size > MAX_ARTWORK_SIZE)
    {
        return Err("Artwork exceeds the 8 MiB safety limit".to_string());
    }
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .split(';')
        .next()
        .unwrap_or("");
    let extension = match content_type {
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/webp" => "webp",
        "image/gif" => "gif",
        _ => return Err("Artwork response is not a supported image".to_string()),
    };
    let mut bytes = Vec::new();
    response
        .take(MAX_ARTWORK_SIZE + 1)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Failed to read artwork: {error}"))?;
    if bytes.len() as u64 > MAX_ARTWORK_SIZE {
        return Err("Artwork exceeds the 8 MiB safety limit".to_string());
    }
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve artwork cache: {error}"))?
        .join("artwork");
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Failed to create artwork cache: {error}"))?;
    for old_extension in ["png", "jpg", "webp", "gif"] {
        if old_extension != extension {
            let _ = fs::remove_file(directory.join(format!("{game_id}.{old_extension}")));
        }
    }
    let path = directory.join(format!("{game_id}.{extension}"));
    let temporary = directory.join(format!(".{game_id}.{extension}.tmp"));
    fs::write(&temporary, bytes).map_err(|error| format!("Failed to save artwork: {error}"))?;
    fs::rename(&temporary, &path).map_err(|error| format!("Failed to publish artwork: {error}"))?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
async fn cache_artwork(
    app: tauri::AppHandle,
    game_id: String,
    source_url: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || cache_artwork_blocking(app, game_id, source_url))
        .await
        .map_err(|error| format!("Artwork worker failed: {error}"))?
}

fn discover_executable(game_dir: &Path, preferred_path: Option<&str>) -> Option<(String, String)> {
    let mut exe_candidates: Vec<PathBuf> = Vec::new();

    fn visit_dir(dir: &Path, candidates: &mut Vec<PathBuf>, depth: usize) {
        if depth > 12 {
            return;
        }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    visit_dir(&path, candidates, depth + 1);
                } else if path.is_file() {
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                        let ext_lower = ext.to_lowercase();
                        if ext_lower == "exe" || ext_lower == "bat" || ext_lower == "com" {
                            candidates.push(path);
                        }
                    }
                }
            }
        }
    }

    visit_dir(game_dir, &mut exe_candidates, 0);

    if exe_candidates.is_empty() {
        return None;
    }

    exe_candidates.sort();

    if let Some(preferred) = preferred_path {
        let normalized = preferred.replace('\\', "/").to_lowercase();
        if let Some(found) = exe_candidates.iter().find(|path| {
            path.strip_prefix(game_dir)
                .ok()
                .map(|relative| {
                    relative.to_string_lossy().replace('\\', "/").to_lowercase() == normalized
                })
                .unwrap_or(false)
        }) {
            return Some(executable_parts(game_dir, found));
        }
    }

    let priority_names = [
        "wolf3d.exe",
        "doom.exe",
        "doom2.exe",
        "duke3d.exe",
        "prince.exe",
        "keen4e.exe",
        "keen4.exe",
        "keen1.exe",
        "sc2000.exe",
        "jazz.exe",
        "tyrian.exe",
        "dr.exe",
        "dune2.exe",
        "civ.exe",
        "war.exe",
        "play.bat",
        "start.exe",
        "main.exe",
        "run.bat",
        "go.bat",
        "game.exe",
    ];

    let mut chosen = exe_candidates
        .iter()
        .find(|path| {
            let stem = path.file_stem().and_then(|name| name.to_str());
            let parent = path
                .parent()
                .and_then(Path::file_name)
                .and_then(|name| name.to_str());
            matches!((stem, parent), (Some(stem), Some(parent)) if stem.eq_ignore_ascii_case(parent))
        })
        .or_else(|| {
            exe_candidates.iter().find(|path| {
                let relative = path.strip_prefix(game_dir).unwrap_or(path);
                let is_game_path = relative.components().next().is_some_and(|component| {
                    component.as_os_str().to_string_lossy().eq_ignore_ascii_case("games")
                });
                let is_binary = path
                    .extension()
                    .and_then(|extension| extension.to_str())
                    .is_some_and(|extension| {
                        extension.eq_ignore_ascii_case("exe") || extension.eq_ignore_ascii_case("com")
                    });
                is_game_path && is_binary
            })
        })
        .unwrap_or(&exe_candidates[0]);
    for p in priority_names {
        if let Some(matching) = exe_candidates.iter().find(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .map(|name| name.eq_ignore_ascii_case(p))
                .unwrap_or(false)
        }) {
            chosen = matching;
            break;
        }
    }

    Some(executable_parts(game_dir, chosen))
}

fn executable_parts(game_dir: &Path, executable: &Path) -> (String, String) {
    let relative = executable.strip_prefix(game_dir).unwrap_or(executable);
    let executable_name = relative
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("START.EXE")
        .to_string();
    let working_dir = relative
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .map(|parent| parent.to_string_lossy().replace('/', "\\"))
        .unwrap_or_default();
    (working_dir, executable_name)
}

fn sanitize_component(value: &str) -> String {
    value
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-' || *c == ' ')
        .collect::<String>()
        .trim()
        .replace(' ', "_")
}

fn is_valid_identifier(identifier: &str) -> bool {
    !identifier.is_empty()
        && identifier.len() <= 200
        && identifier
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.'))
}

#[tauri::command]
fn open_catalog_source(identifier: String, provider: String) -> Result<(), String> {
    if !is_valid_identifier(&identifier) {
        return Err("Invalid catalog identifier".to_string());
    }
    let url = match provider.as_str() {
        "internet-archive" => format!("https://archive.org/details/{identifier}"),
        "freedos" => {
            "https://www.ibiblio.org/pub/micro/pc-stuff/freedos/files/repositories/1.4/games/"
                .to_string()
        }
        _ => return Err("Unsupported catalog provider".to_string()),
    };
    #[cfg(target_os = "macos")]
    let status = Command::new("open").arg(&url).status();
    #[cfg(target_os = "windows")]
    let status = Command::new("rundll32")
        .arg("url.dll,FileProtocolHandler")
        .arg(&url)
        .status();
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    let status = Command::new("xdg-open").arg(&url).status();
    match status {
        Ok(result) if result.success() => Ok(()),
        Ok(result) => Err(format!("Could not open source page (status {result})")),
        Err(error) => Err(format!("Could not open source page: {error}")),
    }
}

fn is_allowed_download_url(url: &str, provider: &str) -> bool {
    let Some(rest) = url.strip_prefix("https://") else {
        return false;
    };
    let authority = rest.split('/').next().unwrap_or_default();
    if authority.is_empty() || authority.contains('@') || authority.contains(':') {
        return false;
    }
    match provider {
        "internet-archive" => authority == "archive.org" || authority.ends_with(".archive.org"),
        "freedos" => {
            authority == "www.ibiblio.org"
                && rest
                    .strip_prefix("www.ibiblio.org")
                    .map(|path| {
                        path.starts_with(
                            "/pub/micro/pc-stuff/freedos/files/repositories/1.4/games/",
                        ) && path.to_ascii_lowercase().ends_with(".zip")
                    })
                    .unwrap_or(false)
        }
        _ => false,
    }
}

fn is_verified_internet_archive_shareware(identifier: &str) -> bool {
    matches!(
        identifier,
        "doom_dos" | "duke-nukem2-sw" | "Raptor-sw1" | "Keen4e-sw"
    )
}

fn encode_url_path(path: &str) -> String {
    let mut encoded = String::with_capacity(path.len());
    for byte in path.as_bytes() {
        if byte.is_ascii_alphanumeric() || matches!(*byte, b'-' | b'_' | b'.' | b'~' | b'/') {
            encoded.push(*byte as char);
        } else {
            encoded.push_str(&format!("%{:02X}", byte));
        }
    }
    encoded
}

fn is_zip_file(path: &Path) -> Result<bool, String> {
    let mut file = File::open(path).map_err(|e| format!("Failed to inspect download: {e}"))?;
    let mut signature = [0_u8; 4];
    file.read_exact(&mut signature)
        .map_err(|e| format!("Downloaded file is incomplete: {e}"))?;
    Ok(matches!(
        signature,
        [0x50, 0x4b, 0x03, 0x04] | [0x50, 0x4b, 0x05, 0x06] | [0x50, 0x4b, 0x07, 0x08]
    ))
}

fn calculate_crc32(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|e| format!("Failed to verify download: {e}"))?;
    let mut hasher = crc32fast::Hasher::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|e| format!("Failed to verify download: {e}"))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:08X}", hasher.finalize()))
}

fn extract_zip_safely(zip_path: &Path, destination: &Path) -> Result<(), String> {
    const MAX_ENTRIES: usize = 50_000;
    const MAX_UNCOMPRESSED_BYTES: u64 = 4 * 1024 * 1024 * 1024;

    let file = File::open(zip_path).map_err(|e| format!("Failed to open ZIP: {e}"))?;
    let mut archive =
        ZipArchive::new(file).map_err(|e| format!("Invalid or unsupported ZIP: {e}"))?;
    if archive.len() > MAX_ENTRIES {
        return Err(format!("ZIP contains too many entries ({})", archive.len()));
    }

    let mut total_size = 0_u64;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|e| format!("Failed to read ZIP entry #{index}: {e}"))?;
        total_size = total_size
            .checked_add(entry.size())
            .ok_or_else(|| "ZIP expanded size overflow".to_string())?;
        if total_size > MAX_UNCOMPRESSED_BYTES {
            return Err("ZIP expands beyond the 4 GiB safety limit".to_string());
        }

        let enclosed = entry
            .enclosed_name()
            .ok_or_else(|| format!("Unsafe path in ZIP: {}", entry.name()))?;
        if enclosed.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        }) {
            return Err(format!("Unsafe path in ZIP: {}", entry.name()));
        }

        let output_path = destination.join(enclosed);
        if entry.is_dir() {
            fs::create_dir_all(&output_path)
                .map_err(|e| format!("Failed to create extracted directory: {e}"))?;
            continue;
        }

        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create extracted directory: {e}"))?;
        }
        let mut output = File::create(&output_path)
            .map_err(|e| format!("Failed to create extracted file: {e}"))?;
        std::io::copy(&mut entry, &mut output)
            .map_err(|e| format!("Failed to extract {}: {e}", entry.name()))?;
        output
            .flush()
            .map_err(|e| format!("Failed to finish extracted file: {e}"))?;
    }
    Ok(())
}

fn download_and_install_archive_game_blocking(
    identifier: String,
    title: String,
    target_base_dir: Option<String>,
    direct_urls: Option<Vec<String>>,
    provider: String,
    expected_crc32: Option<String>,
) -> Result<DownloadGameResult, String> {
    if !is_valid_identifier(&identifier) {
        return Err("Invalid catalog item identifier".to_string());
    }
    if provider != "internet-archive" && provider != "freedos" {
        return Err("Unsupported download provider".to_string());
    }
    if provider == "internet-archive" && !is_verified_internet_archive_shareware(&identifier) {
        return Err(
            "Automatic installation is disabled because this Internet Archive item's redistribution rights are not verified. Import your legally owned copy instead."
                .to_string(),
        );
    }

    let redirect_provider = provider.clone();
    let client = reqwest::blocking::Client::builder()
        .user_agent("GameSky.space/1.0 (+https://gamesky.space)")
        .connect_timeout(std::time::Duration::from_secs(15))
        .timeout(std::time::Duration::from_secs(180))
        .redirect(reqwest::redirect::Policy::custom(move |attempt| {
            if attempt.previous().len() < 6
                && is_allowed_download_url(attempt.url().as_str(), &redirect_provider)
            {
                attempt.follow()
            } else {
                attempt.stop()
            }
        }))
        .build()
        .map_err(|error| format!("Failed to initialize secure HTTP client: {error}"))?;

    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp"));
    let base_dir = if let Some(custom) = target_base_dir {
        if let Some(relative) = custom.strip_prefix("~/") {
            home.join(relative)
        } else {
            PathBuf::from(custom)
        }
    } else {
        home.join("DOSGAMES")
    };

    if !base_dir.is_absolute() {
        return Err(
            "The installation folder must be an absolute path (or start with ~/).".to_string(),
        );
    }

    fs::create_dir_all(&base_dir).map_err(|e| {
        format!(
            "Failed to create installation folder '{}': {e}",
            base_dir.display()
        )
    })?;

    let title_name = sanitize_component(&title);
    let safe_name = if title_name.is_empty() {
        sanitize_component(&identifier)
    } else {
        title_name
    };

    let game_dir = base_dir.join(&safe_name);
    if game_dir.exists() {
        if let Some((working_dir, executable)) = discover_executable(&game_dir, None) {
            return Ok(DownloadGameResult {
                success: true,
                installed: true,
                message: format!("'{}' is already installed.", title),
                target_folder: game_dir.to_string_lossy().to_string(),
                executable,
                working_dir,
            });
        }
        fs::remove_dir(&game_dir).map_err(|e| {
            format!("Installation target already exists and is not an installed game: {e}")
        })?;
    }

    let mut candidate_urls: Vec<String> = Vec::new();

    // 1. Add any explicit direct mirror URLs provided
    if let Some(urls) = direct_urls {
        for u in urls {
            if is_allowed_download_url(u.trim(), &provider) {
                candidate_urls.push(u.trim().to_string());
            }
        }
    }

    // 2. Fetch metadata from Internet Archive to discover dynamic ZIP filenames.
    let mut preferred_executable: Option<String> = None;
    if provider == "internet-archive" {
        let meta_url = format!("https://archive.org/metadata/{}", identifier);
        if let Ok(response) = client
            .get(&meta_url)
            .timeout(std::time::Duration::from_secs(30))
            .send()
            .and_then(reqwest::blocking::Response::error_for_status)
        {
            if response.content_length().unwrap_or(0) <= 10 * 1024 * 1024 {
                let mut metadata_bytes = Vec::new();
                if response
                    .take(10 * 1024 * 1024 + 1)
                    .read_to_end(&mut metadata_bytes)
                    .is_ok()
                    && metadata_bytes.len() <= 10 * 1024 * 1024
                {
                    if let Ok(meta_json) =
                        serde_json::from_slice::<serde_json::Value>(&metadata_bytes)
                    {
                        preferred_executable = meta_json
                            .pointer("/metadata/emulator_start")
                            .and_then(|value| value.as_str())
                            .map(str::to_string);
                        let archive_hosts: Vec<&str> = ["d1", "d2"]
                            .iter()
                            .filter_map(|key| meta_json.get(*key).and_then(|value| value.as_str()))
                            .filter(|host| *host == "archive.org" || host.ends_with(".archive.org"))
                            .collect();
                        if let Some(files) = meta_json.get("files").and_then(|f| f.as_array()) {
                            let mut zip_files: Vec<&serde_json::Value> = files
                                .iter()
                                .filter(|file| {
                                    file.get("name")
                                        .and_then(|name| name.as_str())
                                        .map(|name| name.to_lowercase().ends_with(".zip"))
                                        .unwrap_or(false)
                                })
                                .collect();
                            zip_files.sort_by_key(|file| {
                                let original = file.get("source").and_then(|value| value.as_str())
                                    == Some("original");
                                let metadata = file
                                    .get("name")
                                    .and_then(|value| value.as_str())
                                    .map(|name| name.contains("_meta") || name.contains("_thumb"))
                                    .unwrap_or(true);
                                (!original, metadata)
                            });
                            for file in zip_files {
                                if let Some(name) = file.get("name").and_then(|n| n.as_str()) {
                                    let encoded_name = encode_url_path(name);
                                    candidate_urls.push(format!(
                                        "https://archive.org/download/{identifier}/{encoded_name}"
                                    ));
                                    for host in &archive_hosts {
                                        candidate_urls.push(format!(
                                            "https://{host}/items/{identifier}/{encoded_name}"
                                        ));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. Add standard archive.org direct fallbacks.
    if provider == "internet-archive" {
        candidate_urls.push(format!(
            "https://archive.org/download/{}/{}.zip",
            identifier, identifier
        ));
        candidate_urls.push(format!(
            "https://archive.org/download/{}/{}_dos.zip",
            identifier, identifier
        ));
    }

    let mut seen_urls = HashSet::new();
    candidate_urls
        .retain(|url| is_allowed_download_url(url, &provider) && seen_urls.insert(url.clone()));
    if candidate_urls.is_empty() {
        return Err("No approved download URL is available for this item".to_string());
    }

    let temp_zip =
        std::env::temp_dir().join(format!("archive_{}_{}.zip", identifier, std::process::id()));
    let mut downloaded = false;
    let mut last_error = String::new();

    // 4. Try candidate URLs in order
    for url in &candidate_urls {
        let _ = fs::remove_file(&temp_zip);
        for attempt in 1..=3 {
            let response = client
                .get(url)
                .send()
                .and_then(reqwest::blocking::Response::error_for_status);
            match response {
                Ok(response) => {
                    const MAX_DOWNLOAD_SIZE: u64 = 2 * 1024 * 1024 * 1024;
                    if response
                        .content_length()
                        .is_some_and(|size| size > MAX_DOWNLOAD_SIZE)
                    {
                        last_error = "Mirror file exceeds the 2 GiB safety limit".to_string();
                        break;
                    }
                    match File::create(&temp_zip) {
                        Ok(mut output) => {
                            let copied = std::io::copy(
                                &mut response.take(MAX_DOWNLOAD_SIZE + 1),
                                &mut output,
                            );
                            if let Err(error) = output.flush() {
                                last_error = format!("Failed to finish download: {error}");
                                continue;
                            }
                            match copied {
                                Ok(size) if size > MAX_DOWNLOAD_SIZE => {
                                    last_error =
                                        "Mirror file exceeds the 2 GiB safety limit".to_string();
                                    break;
                                }
                                Ok(size) if size > 1000 => match is_zip_file(&temp_zip) {
                                    Ok(true) => {
                                        downloaded = true;
                                        break;
                                    }
                                    Ok(false) => {
                                        last_error =
                                            "Mirror returned a non-ZIP response".to_string()
                                    }
                                    Err(error) => last_error = error,
                                },
                                Ok(_) => {
                                    last_error =
                                        "Mirror returned an empty or incomplete file".to_string()
                                }
                                Err(error) => {
                                    last_error = format!("Download stream failed: {error}")
                                }
                            }
                        }
                        Err(error) => {
                            last_error = format!("Failed to create temporary download: {error}");
                            break;
                        }
                    }
                }
                Err(error) => last_error = format!("HTTP attempt {attempt} failed: {error}"),
            }
            let _ = fs::remove_file(&temp_zip);
        }
        if downloaded {
            break;
        }
    }

    if !downloaded || !temp_zip.exists() {
        let _ = fs::remove_file(&temp_zip);
        return Err(format!(
            "Failed to download '{}' from available mirrors. Error: {}",
            title,
            if last_error.is_empty() {
                "All mirrors unreachable"
            } else {
                &last_error
            }
        ));
    }

    if let Some(expected) = expected_crc32
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if expected.len() != 8 || !expected.chars().all(|c| c.is_ascii_hexdigit()) {
            let _ = fs::remove_file(&temp_zip);
            return Err("Invalid expected CRC32 value".to_string());
        }
        let actual = calculate_crc32(&temp_zip)?;
        if !actual.eq_ignore_ascii_case(expected) {
            let _ = fs::remove_file(&temp_zip);
            return Err(format!(
                "Download integrity check failed (expected {expected}, received {actual})"
            ));
        }
    }

    // 5. Extract into a staging directory and only publish a complete installation.
    let staging = tempfile::Builder::new()
        .prefix(".dosbox-install-")
        .tempdir_in(&base_dir)
        .map_err(|e| format!("Failed to create installation staging folder: {e}"))?;
    let payload = staging.path().join("payload");
    fs::create_dir(&payload).map_err(|e| format!("Failed to create extraction folder: {e}"))?;
    let extraction_result = extract_zip_safely(&temp_zip, &payload);
    let _ = fs::remove_file(&temp_zip);
    extraction_result?;

    let (working_dir, found_exe) = discover_executable(&payload, preferred_executable.as_deref())
        .ok_or_else(|| {
        "The downloaded ZIP contains no DOS executable (.EXE, .COM or .BAT).".to_string()
    })?;

    fs::rename(&payload, &game_dir).map_err(|e| format!("Failed to finalize installation: {e}"))?;

    Ok(DownloadGameResult {
        success: true,
        installed: true,
        message: format!("Successfully downloaded and installed '{}'!", title),
        target_folder: game_dir.to_string_lossy().to_string(),
        executable: found_exe,
        working_dir,
    })
}

#[tauri::command]
async fn download_and_install_archive_game(
    identifier: String,
    title: String,
    target_base_dir: Option<String>,
    direct_urls: Option<Vec<String>>,
    provider: String,
    expected_crc32: Option<String>,
) -> Result<DownloadGameResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        download_and_install_archive_game_blocking(
            identifier,
            title,
            target_base_dir,
            direct_urls,
            provider,
            expected_crc32,
        )
    })
    .await
    .map_err(|e| format!("Download worker failed: {e}"))?
}

fn expand_home_path(path: &str) -> PathBuf {
    if let Some(relative) = path.strip_prefix("~/") {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("/tmp"))
            .join(relative)
    } else {
        PathBuf::from(path)
    }
}

fn safe_relative_dos_path(value: &str, label: &str) -> Result<PathBuf, String> {
    let normalized = value.replace('\\', "/");
    let path = PathBuf::from(normalized);
    if path.is_absolute()
        || path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err(format!("Invalid {label} path"));
    }
    Ok(path)
}

fn validate_cue_dependencies(cue_path: &Path) -> Result<(), String> {
    let content = fs::read_to_string(cue_path)
        .map_err(|error| format!("Failed to read CUE sheet '{}': {error}", cue_path.display()))?;
    let parent = cue_path.parent().unwrap_or_else(|| Path::new("."));
    for line in content.lines() {
        let trimmed = line.trim();
        if !trimmed.to_ascii_uppercase().starts_with("FILE ") {
            continue;
        }
        let reference = if let Some(start) = trimmed.find('"') {
            let rest = &trimmed[start + 1..];
            rest.find('"').map(|end| &rest[..end])
        } else {
            trimmed.split_whitespace().nth(1)
        };
        let Some(reference) = reference else {
            return Err(format!(
                "CUE sheet '{}' contains an invalid FILE line",
                cue_path.display()
            ));
        };
        let relative = safe_relative_dos_path(reference, "CUE track")?;
        let track = parent.join(relative);
        if !track.is_file() {
            return Err(format!(
                "CUE sheet '{}' references missing track '{}'",
                cue_path.display(),
                track.display()
            ));
        }
    }
    Ok(())
}

#[tauri::command]
fn validate_media_paths(items: Vec<MediaPathRequest>) -> Result<Vec<String>, String> {
    let mut validated = Vec::with_capacity(items.len());
    for item in items {
        let expanded = expand_home_path(item.path.trim());
        let canonical = expanded
            .canonicalize()
            .map_err(|_| format!("Media file was not found at '{}'.", expanded.display()))?;
        if canonical.is_dir() {
            if item.kind != "directory" && item.kind != "cdrom" {
                return Err(format!(
                    "'{}' is a folder, not a disk image.",
                    canonical.display()
                ));
            }
        } else if canonical.is_file() {
            let extension = canonical
                .extension()
                .and_then(|value| value.to_str())
                .unwrap_or("")
                .to_ascii_lowercase();
            let supported = match item.kind.as_str() {
                "floppy" => matches!(extension.as_str(), "img" | "ima" | "vfd"),
                "cdrom" => matches!(
                    extension.as_str(),
                    "iso" | "cue" | "bin" | "img" | "nrg" | "mds" | "mdf"
                ),
                "directory" => false,
                _ => false,
            };
            if !supported {
                return Err(format!(
                    "Unsupported {} image '{}'.",
                    item.kind,
                    canonical.display()
                ));
            }
            if extension == "cue" {
                validate_cue_dependencies(&canonical)?;
            }
        } else {
            return Err(format!(
                "Media path '{}' is not usable.",
                canonical.display()
            ));
        }
        validated.push(canonical.to_string_lossy().to_string());
    }
    Ok(validated)
}

fn collect_executable_files(directory: &Path, depth: usize, results: &mut Vec<PathBuf>) {
    if depth > 12 {
        return;
    }
    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            collect_executable_files(&path, depth + 1, results);
        } else if file_type.is_file()
            && path
                .extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| {
                    matches!(
                        extension.to_ascii_lowercase().as_str(),
                        "exe" | "com" | "bat"
                    )
                })
        {
            results.push(path);
        }
    }
}

fn is_windows_pe(path: &Path) -> bool {
    let Ok(mut file) = File::open(path) else {
        return false;
    };
    let mut header = [0_u8; 64];
    if file.read_exact(&mut header).is_err() || &header[..2] != b"MZ" {
        return false;
    }
    let offset =
        u32::from_le_bytes([header[0x3c], header[0x3d], header[0x3e], header[0x3f]]) as u64;
    if file.seek(SeekFrom::Start(offset)).is_err() {
        return false;
    }
    let mut signature = [0_u8; 4];
    file.read_exact(&mut signature).is_ok() && signature == *b"PE\0\0"
}

fn score_executable(game_dir: &Path, path: &Path) -> ExecutableCandidate {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("");
    let lower = file_name.to_ascii_lowercase();
    let relative = path.strip_prefix(game_dir).unwrap_or(path);
    let depth = relative.components().count().saturating_sub(1) as i32;
    let parent_matches = path
        .parent()
        .and_then(Path::file_name)
        .and_then(|name| name.to_str())
        .zip(path.file_stem().and_then(|name| name.to_str()))
        .is_some_and(|(parent, stem)| parent.eq_ignore_ascii_case(stem));
    let mut score = 100 - depth * 8;
    let mut role = "game".to_string();
    let mut reasons = Vec::new();

    if ["uninst", "uninstall", "remove"]
        .iter()
        .any(|word| lower.contains(word))
    {
        score -= 900;
        role = "uninstaller".to_string();
        reasons.push("uninstaller name");
    } else if ["setup", "install", "config", "setsound", "sound"]
        .iter()
        .any(|word| lower.contains(word))
    {
        score -= 220;
        role = if lower.contains("install") || lower.contains("setup") {
            "installer".to_string()
        } else {
            "configuration".to_string()
        };
        reasons.push("setup/configuration utility");
    }
    if [
        "play.bat",
        "start.bat",
        "start.exe",
        "game.exe",
        "run.bat",
        "go.bat",
    ]
    .contains(&lower.as_str())
    {
        score += 180;
        reasons.push("common game launcher name");
    }
    if parent_matches {
        score += 120;
        reasons.push("matches its game folder");
    }
    if path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("com"))
    {
        score += 25;
        reasons.push("DOS COM executable");
    }
    if is_windows_pe(path) {
        score -= 600;
        role = "windows".to_string();
        reasons.push("Windows PE executable");
    } else if lower.ends_with(".exe") {
        score += 35;
        reasons.push("DOS-compatible EXE candidate");
    }

    let (working_dir, executable) = executable_parts(game_dir, path);
    ExecutableCandidate {
        executable,
        working_dir,
        absolute_path: path.to_string_lossy().to_string(),
        score,
        role,
        reason: reasons.join(", "),
    }
}

#[tauri::command]
fn inspect_game_folder(game_dir: String) -> Result<Vec<ExecutableCandidate>, String> {
    let root = expand_home_path(game_dir.trim());
    let canonical = root
        .canonicalize()
        .map_err(|_| format!("Game folder '{}' was not found.", root.display()))?;
    if !canonical.is_dir() {
        return Err(format!("'{}' is not a folder.", canonical.display()));
    }
    let mut files = Vec::new();
    collect_executable_files(&canonical, 0, &mut files);
    let mut candidates = files
        .iter()
        .map(|path| score_executable(&canonical, path))
        .collect::<Vec<_>>();
    candidates.sort_by(|left, right| {
        right
            .score
            .cmp(&left.score)
            .then_with(|| left.absolute_path.cmp(&right.absolute_path))
    });
    Ok(candidates)
}

#[tauri::command]
fn diagnose_game(
    binary_path: String,
    game_dir: String,
    working_dir: String,
    executable: String,
    media_paths: Vec<MediaPathRequest>,
) -> Vec<DiagnosticItem> {
    let mut results = Vec::new();
    let emulator = expand_home_path(binary_path.trim());
    results.push(if emulator.is_file() {
        DiagnosticItem {
            id: "emulator".into(),
            status: "ok".into(),
            label: "DOSBox emulator".into(),
            message: emulator.to_string_lossy().to_string(),
            repair_action: None,
        }
    } else {
        DiagnosticItem {
            id: "emulator".into(),
            status: "error".into(),
            label: "DOSBox emulator".into(),
            message: "Configured emulator was not found.".into(),
            repair_action: Some("detect-emulator".into()),
        }
    });

    let root = expand_home_path(game_dir.trim());
    let root_ok = root.is_dir();
    results.push(if root_ok {
        DiagnosticItem {
            id: "game-folder".into(),
            status: "ok".into(),
            label: "Game folder".into(),
            message: root.to_string_lossy().to_string(),
            repair_action: None,
        }
    } else {
        DiagnosticItem {
            id: "game-folder".into(),
            status: "error".into(),
            label: "Game folder".into(),
            message: "The game folder is missing or disconnected.".into(),
            repair_action: Some("locate-game-folder".into()),
        }
    });

    if root_ok {
        let work =
            safe_relative_dos_path(working_dir.trim(), "working directory").unwrap_or_default();
        let exe = safe_relative_dos_path(executable.trim(), "executable").unwrap_or_default();
        let executable_path = root.join(work).join(exe);
        results.push(if executable_path.is_file() {
            DiagnosticItem {
                id: "executable".into(),
                status: "ok".into(),
                label: "Game executable".into(),
                message: executable_path.to_string_lossy().to_string(),
                repair_action: None,
            }
        } else {
            DiagnosticItem {
                id: "executable".into(),
                status: "error".into(),
                label: "Game executable".into(),
                message: format!("'{}' was not found.", executable_path.display()),
                repair_action: Some("scan-executables".into()),
            }
        });
    }

    match validate_media_paths(media_paths) {
        Ok(paths) => results.push(DiagnosticItem {
            id: "media".into(),
            status: "ok".into(),
            label: "Game media".into(),
            message: if paths.is_empty() {
                "No external media required.".into()
            } else {
                format!("{} media item(s) verified.", paths.len())
            },
            repair_action: None,
        }),
        Err(error) => results.push(DiagnosticItem {
            id: "media".into(),
            status: "error".into(),
            label: "Game media".into(),
            message: error,
            repair_action: Some("open-media-manager".into()),
        }),
    }
    results
}

#[tauri::command]
fn prepare_game_launch(
    game_dir: String,
    working_dir: String,
    executable: String,
    cd_rom_path: String,
) -> Result<PreparedGameLaunch, String> {
    if game_dir.trim().is_empty() {
        return Err(
            "The game folder is not configured. Install the game from Catalog first.".to_string(),
        );
    }
    if executable.trim().is_empty() {
        return Err("The game executable is not configured.".to_string());
    }

    let root = expand_home_path(game_dir.trim());
    let canonical_root = root.canonicalize().map_err(|_| {
        format!(
            "Game files were not found at '{}'. Install the game from Catalog first.",
            root.display()
        )
    })?;
    if !canonical_root.is_dir() {
        return Err(format!(
            "The game path '{}' is not a folder.",
            root.display()
        ));
    }

    let relative_working_dir = safe_relative_dos_path(working_dir.trim(), "working directory")?;
    let relative_executable = safe_relative_dos_path(executable.trim(), "executable")?;
    let launch_dir = canonical_root.join(&relative_working_dir);
    let canonical_launch_dir = launch_dir.canonicalize().map_err(|_| {
        format!(
            "The game working directory '{}' does not exist.",
            launch_dir.display()
        )
    })?;
    if !canonical_launch_dir.is_dir() || !canonical_launch_dir.starts_with(&canonical_root) {
        return Err("The game working directory is outside the installed game folder.".to_string());
    }

    let executable_path = canonical_launch_dir.join(&relative_executable);
    let canonical_executable = executable_path.canonicalize().map_err(|_| {
        format!(
            "Executable '{}' was not found. Reinstall the game from Catalog or edit its profile.",
            executable_path.display()
        )
    })?;
    if !canonical_executable.is_file() || !canonical_executable.starts_with(&canonical_root) {
        return Err("The configured executable is outside the installed game folder.".to_string());
    }

    let prepared_cd_rom = if cd_rom_path.trim().is_empty() {
        String::new()
    } else {
        let cd_path = expand_home_path(cd_rom_path.trim());
        let canonical_cd = cd_path.canonicalize().map_err(|_| {
            format!(
                "CD-ROM media was not found at '{}'. Select the image or mounted disc again.",
                cd_path.display()
            )
        })?;
        if canonical_cd.is_file() {
            let extension = canonical_cd
                .extension()
                .and_then(|value| value.to_str())
                .unwrap_or("")
                .to_ascii_lowercase();
            if !matches!(
                extension.as_str(),
                "iso" | "cue" | "bin" | "img" | "nrg" | "mds" | "mdf"
            ) {
                return Err(
                    "Unsupported CD image. Select an ISO, CUE, BIN, IMG, NRG, MDS/MDF, or a mounted disc folder."
                        .to_string(),
                );
            }
        } else if !canonical_cd.is_dir() {
            return Err("The selected CD-ROM media is neither an image nor a folder.".to_string());
        }
        canonical_cd.to_string_lossy().to_string()
    };

    Ok(PreparedGameLaunch {
        // Mount the executable's directory directly as C:. Besides being simpler for
        // games, this avoids DOS 8.3 aliases for long host-side directory names.
        c_drive_path: canonical_launch_dir.to_string_lossy().to_string(),
        working_dir: String::new(),
        executable: executable.trim().replace('/', "\\"),
        cd_rom_path: prepared_cd_rom,
    })
}

#[tauri::command]
fn scan_installed_games(base_dir: String) -> Result<Vec<DiscoveredGame>, String> {
    let root = expand_home_path(base_dir.trim());
    if !root.exists() {
        return Ok(Vec::new());
    }
    if !root.is_dir() {
        return Err(format!(
            "The game library path '{}' is not a folder.",
            root.display()
        ));
    }

    let mut games = Vec::new();
    let entries = fs::read_dir(&root)
        .map_err(|e| format!("Failed to scan game library '{}': {e}", root.display()))?;
    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() || file_type.is_symlink() {
            continue;
        }
        let folder = entry.path();
        let Some((working_dir, executable)) = discover_executable(&folder, None) else {
            continue;
        };
        let title = entry
            .file_name()
            .to_string_lossy()
            .replace(['_', '-'], " ")
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
        games.push(DiscoveredGame {
            title,
            target_folder: folder.to_string_lossy().to_string(),
            working_dir,
            executable,
        });
    }
    games.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    Ok(games)
}

#[tauri::command]
fn launch_dosbox_command(
    app: tauri::AppHandle,
    binary_path: String,
    conf_content: String,
    game_title: String,
    game_id: Option<String>,
    emulator_type: Option<String>,
) -> Result<LaunchResult, String> {
    if conf_content.len() > 1024 * 1024 || conf_content.contains('\0') {
        return Err("Generated DOSBox configuration is invalid or too large".to_string());
    }
    let temp_dir = std::env::temp_dir();
    let sanitized_title = game_title
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .take(80)
        .collect::<String>();
    let timestamp = std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis())
        .unwrap_or(0);
    let conf_path: PathBuf = temp_dir.join(format!(
        "gamesky_{}_{}_{}.conf",
        sanitized_title,
        std::process::id(),
        timestamp
    ));

    if let Err(e) = fs::write(&conf_path, &conf_content) {
        return Ok(LaunchResult {
            success: false,
            message: format!("Failed to write temporary DOSBox config: {}", e),
            command_executed: None,
            conf_generated: Some(conf_content),
            session_id: None,
        });
    }

    let conf_path_str = conf_path.to_string_lossy().to_string();

    let requested_binary = binary_path.clone();
    let (resolved_binary, used_fallback) = if Path::new(&binary_path).is_file() {
        (binary_path, false)
    } else {
        let installations = detect_dosbox_installations();
        let available = installations
            .iter()
            .find(|installation| {
                installation.exists && installation.emulator_type == "dosbox-staging"
            })
            .or_else(|| {
                installations
                    .iter()
                    .find(|installation| installation.exists)
            });
        let Some(installation) = available else {
            return Ok(LaunchResult {
                success: false,
                message: format!(
                    "DOSBox was not found. The configured path '{}' does not exist; install DOSBox Staging or select it in Settings.",
                    requested_binary
                ),
                command_executed: None,
                conf_generated: Some(conf_content),
                session_id: None,
            });
        };
        (installation.path.clone(), true)
    };

    let command_display = format!("\"{}\" -conf \"{}\"", resolved_binary, conf_path_str);
    let child_res = Command::new(&resolved_binary)
        .arg("-conf")
        .arg(&conf_path_str)
        .spawn();

    match child_res {
        Ok(mut child) => {
            let session = game_id.as_ref().and_then(|id| {
                database::database_start_play_session(
                    app.clone(),
                    id.clone(),
                    emulator_type
                        .clone()
                        .unwrap_or_else(|| "dosbox".to_string()),
                )
                .ok()
            });
            let tracked_session = game_id.zip(session);
            let app_handle = app.clone();
            let cleanup_conf_path = conf_path.clone();
            std::thread::spawn(move || {
                let exit_status = child
                    .wait()
                    .map(|status| {
                        status
                            .code()
                            .map(|code| code.to_string())
                            .unwrap_or_else(|| "terminated".to_string())
                    })
                    .unwrap_or_else(|error| format!("wait-error:{error}"));
                if let Some((id, session_id)) = tracked_session {
                    let duration_seconds = database::database_finish_play_session(
                        app_handle.clone(),
                        session_id,
                        exit_status.clone(),
                    )
                    .unwrap_or(0);
                    let _ = app_handle.emit(
                        "game-session-ended",
                        GameSessionEnded {
                            game_id: id,
                            session_id,
                            duration_seconds,
                            exit_status,
                        },
                    );
                }
                let _ = fs::remove_file(cleanup_conf_path);
            });
            Ok(LaunchResult {
                success: true,
                message: if used_fallback {
                    format!(
                        "Started '{}' with the automatically detected DOSBox at '{}'.",
                        game_title, resolved_binary
                    )
                } else {
                    format!("Successfully started DOSBox for '{}'!", game_title)
                },
                command_executed: Some(command_display),
                conf_generated: Some(conf_content),
                session_id: session,
            })
        }
        Err(e) => Ok(LaunchResult {
            success: false,
            message: format!("Failed to spawn DOSBox process: {}", e),
            command_executed: Some(command_display),
            conf_generated: Some(conf_content),
            session_id: None,
        }),
    }
}

#[tauri::command]
fn detect_dosbox_installations() -> Vec<DosboxInstallation> {
    let mut list = Vec::new();
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp"));

    let candidates = vec![
        (
            "DOSBox (Official App)",
            "/Applications/DOSBox.app/Contents/MacOS/DOSBox".to_string(),
            "dosbox",
        ),
        (
            "DOSBox (User Apps)",
            home.join("Applications/DOSBox.app/Contents/MacOS/DOSBox")
                .to_string_lossy()
                .to_string(),
            "dosbox",
        ),
        (
            "DOSBox (Homebrew)",
            "/opt/homebrew/bin/dosbox".to_string(),
            "dosbox",
        ),
        (
            "DOSBox (/usr/local/bin)",
            "/usr/local/bin/dosbox".to_string(),
            "dosbox",
        ),
        (
            "DOSBox (/opt/local/bin)",
            "/opt/local/bin/dosbox".to_string(),
            "dosbox",
        ),
        (
            "DOSBox Staging (App)",
            "/Applications/DOSBox Staging.app/Contents/MacOS/dosbox".to_string(),
            "dosbox-staging",
        ),
        (
            "DOSBox-Staging (App)",
            "/Applications/DOSBox-Staging.app/Contents/MacOS/dosbox".to_string(),
            "dosbox-staging",
        ),
        (
            "DOSBox Staging (Homebrew)",
            "/opt/homebrew/bin/dosbox-staging".to_string(),
            "dosbox-staging",
        ),
        (
            "DOSBox-Staging (/usr/local/bin)",
            "/usr/local/bin/dosbox-staging".to_string(),
            "dosbox-staging",
        ),
        (
            "DOSBox-X (App)",
            "/Applications/DOSBox-X.app/Contents/MacOS/dosbox-x".to_string(),
            "dosbox-x",
        ),
        (
            "DOSBoxX (App)",
            "/Applications/DOSBoxX.app/Contents/MacOS/dosbox-x".to_string(),
            "dosbox-x",
        ),
        (
            "DOSBox-X (Homebrew)",
            "/opt/homebrew/bin/dosbox-x".to_string(),
            "dosbox-x",
        ),
        (
            "DOSBox-X (/usr/local/bin)",
            "/usr/local/bin/dosbox-x".to_string(),
            "dosbox-x",
        ),
    ];

    for (name, path, emu_type) in candidates {
        if path.is_empty() {
            continue;
        }
        let exists = Path::new(&path).is_file();
        list.push(DosboxInstallation {
            name: name.to_string(),
            path,
            emulator_type: emu_type.to_string(),
            exists,
        });
    }

    list
}

#[tauri::command]
fn toggle_app_fullscreen(window: tauri::Window) -> Result<bool, String> {
    let is_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
    window
        .set_fullscreen(!is_fullscreen)
        .map_err(|e| e.to_string())?;
    Ok(!is_fullscreen)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_dialog::init());
    if option_env!("GAMESKY_UPDATER_PUBKEY")
        .map(str::trim)
        .is_some_and(|value| !value.is_empty())
    {
        builder = builder.plugin(
            tauri_plugin_updater::Builder::new()
                .target("macos-universal")
                .build(),
        );
    }
    builder
        .invoke_handler(tauri::generate_handler![
            database::database_initialize,
            database::database_import_legacy,
            database::database_load_games,
            database::database_save_games,
            database::database_load_preferences,
            database::database_save_preferences,
            database::database_save_diagnostics,
            database::database_start_play_session,
            database::database_finish_play_session,
            check_for_update,
            install_available_update,
            pick_file_native,
            pick_files_native,
            pick_folder_native,
            export_library_backup,
            import_library_backup,
            save_mapper_profile,
            inspect_game_folder,
            diagnose_game,
            validate_media_paths,
            scan_game_saves,
            create_save_backup,
            list_save_backups,
            restore_save_backup,
            delete_save_backup,
            open_folder_in_finder,
            cache_artwork,
            open_catalog_source,
            download_and_install_archive_game,
            prepare_game_launch,
            scan_installed_games,
            launch_dosbox_command,
            detect_dosbox_installations,
            toggle_app_fullscreen
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn archive_inputs_are_restricted() {
        assert!(is_valid_identifier("msdos_Wolfenstein_3D_1992"));
        assert!(!is_valid_identifier("../../private"));
        assert!(is_allowed_download_url(
            "https://archive.org/download/item/game.zip",
            "internet-archive"
        ));
        assert!(is_allowed_download_url(
            "https://ia800400.us.archive.org/items/item/game.zip",
            "internet-archive"
        ));
        assert!(is_allowed_download_url(
            "https://www.ibiblio.org/pub/micro/pc-stuff/freedos/files/repositories/1.4/games/wing.zip",
            "freedos"
        ));
        assert!(!is_allowed_download_url(
            "https://www.ibiblio.org/pub/micro/pc-stuff/freedos/files/repositories/1.4/base/kernel.zip",
            "freedos"
        ));
        assert!(!is_allowed_download_url(
            "http://archive.org/game.zip",
            "internet-archive"
        ));
        assert!(!is_allowed_download_url(
            "https://archive.org@example.com/game.zip",
            "internet-archive"
        ));
        assert!(!is_allowed_download_url(
            "https://example.com/game.zip",
            "freedos"
        ));
        assert!(is_verified_internet_archive_shareware("doom_dos"));
        assert!(!is_verified_internet_archive_shareware(
            "msdos_Prince_of_Persia_1990"
        ));
    }

    #[test]
    fn archive_paths_are_encoded() {
        assert_eq!(
            encode_url_path("DOS Games/Game #1.zip"),
            "DOS%20Games/Game%20%231.zip"
        );
    }

    #[test]
    fn crc32_matches_standard_test_vector() {
        let temp = tempfile::NamedTempFile::new().expect("temp file");
        fs::write(temp.path(), b"123456789").expect("write test vector");
        assert_eq!(calculate_crc32(temp.path()).expect("crc32"), "CBF43926");
    }

    #[test]
    fn preferred_executable_preserves_working_directory() {
        let temp = tempfile::tempdir().expect("temp dir");
        let nested = temp.path().join("Wolf3D/WOLF3D");
        fs::create_dir_all(&nested).expect("nested dir");
        fs::write(nested.join("WOLF3D.EXE"), b"test").expect("executable");

        let discovered = discover_executable(temp.path(), Some("Wolf3D/WOLF3D/WOLF3D.EXE"));
        assert_eq!(
            discovered,
            Some(("Wolf3D\\WOLF3D".to_string(), "WOLF3D.EXE".to_string()))
        );
    }

    #[test]
    fn game_launch_is_validated_before_starting_dosbox() {
        let temp = tempfile::tempdir().expect("temp dir");
        let game = temp.path().join("Prehistoric");
        let working = game.join("Prehist2");
        fs::create_dir_all(&working).expect("game directory");
        fs::write(working.join("PRE2.EXE"), b"dos executable").expect("game executable");
        let cd_image = temp.path().join("PREHIST2.ISO");
        fs::write(&cd_image, b"iso image placeholder").expect("cd image");

        let prepared = prepare_game_launch(
            game.to_string_lossy().to_string(),
            "Prehist2".to_string(),
            "PRE2.EXE".to_string(),
            cd_image.to_string_lossy().to_string(),
        )
        .expect("valid installed game");

        assert_eq!(prepared.working_dir, "");
        assert_eq!(prepared.executable, "PRE2.EXE");
        assert!(Path::new(&prepared.c_drive_path).is_absolute());
        assert!(prepared.c_drive_path.ends_with("Prehistoric/Prehist2"));
        assert!(prepared.cd_rom_path.ends_with("PREHIST2.ISO"));

        let discovered = scan_installed_games(temp.path().to_string_lossy().to_string())
            .expect("scan installed games");
        assert_eq!(discovered.len(), 1);
        assert_eq!(discovered[0].title, "Prehistoric");
        assert_eq!(discovered[0].working_dir, "Prehist2");
        assert_eq!(discovered[0].executable, "PRE2.EXE");

        let missing = prepare_game_launch(
            game.to_string_lossy().to_string(),
            "Prehist2".to_string(),
            "MISSING.EXE".to_string(),
            String::new(),
        );
        assert!(missing.is_err());
    }

    #[test]
    fn save_scan_finds_nested_files_and_preserves_relative_path() {
        let temp = tempfile::tempdir().expect("temp dir");
        let nested = temp.path().join("GAME/SAVES");
        fs::create_dir_all(&nested).expect("nested dir");
        fs::write(nested.join("SLOT1.SAV"), b"save").expect("save file");

        let saves = scan_game_saves(temp.path().to_string_lossy().to_string()).expect("scan");
        assert_eq!(saves.len(), 1);
        assert_eq!(saves[0].relative_path, "GAME/SAVES/SLOT1.SAV");
    }

    #[test]
    #[ignore = "network smoke test"]
    fn downloads_and_installs_real_archive_zip() {
        let target = tempfile::tempdir().expect("temp dir");
        let result = download_and_install_archive_game_blocking(
            "doom_dos".to_string(),
            "DOOM Shareware Audit".to_string(),
            Some(target.path().to_string_lossy().to_string()),
            Some(vec![
                "https://archive.org/download/doom_dos/doom.zip".to_string()
            ]),
            "internet-archive".to_string(),
            None,
        )
        .expect("download and install");

        assert!(result.installed);
        assert_eq!(result.executable.to_lowercase(), "doom.exe");
        assert!(Path::new(&result.target_folder).is_dir());
    }

    #[test]
    #[ignore = "network smoke test"]
    fn downloads_verifies_and_installs_freedos_package() {
        let target = tempfile::tempdir().expect("temp dir");
        let result = download_and_install_archive_game_blocking(
            "dosdef".to_string(),
            "DOS Defender Audit".to_string(),
            Some(target.path().to_string_lossy().to_string()),
            Some(vec![
                "https://www.ibiblio.org/pub/micro/pc-stuff/freedos/files/repositories/1.4/games/dosdef.zip"
                    .to_string(),
            ]),
            "freedos".to_string(),
            Some("B4B8B772".to_string()),
        )
        .expect("download and install FreeDOS package");

        assert!(result.installed);
        assert_eq!(result.executable, "DOSDEF.COM");
        assert_eq!(result.working_dir, "GAMES\\DOSDEF");
    }
}
