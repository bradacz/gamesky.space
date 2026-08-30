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
    #[serde(rename = "cdRomPath", default)]
    pub cd_rom_path: Option<String>,
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

#[derive(Serialize, Deserialize, Debug, Clone)]
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

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredArchiveItem {
    pub file_name: String,
    pub file_path: String,
    pub relative_path: String,
    pub format: String,
    pub size_bytes: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UnpackArchiveResult {
    pub success: bool,
    pub message: String,
    pub extracted_files_count: usize,
    pub discovered_executable: Option<String>,
    pub discovered_working_dir: Option<String>,
    #[serde(default)]
    pub discovered_cd_rom_path: Option<String>,
    #[serde(default)]
    pub discovered_title: Option<String>,
    pub installer_candidates: Vec<ExecutableCandidate>,
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

/// Identifies an image by magic bytes rather than by extension, so a mislabeled
/// or non-image file can't be written into the artwork cache.
fn image_extension_from_bytes(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]) {
        return Some("png");
    }
    if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        return Some("jpg");
    }
    if bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" {
        return Some("webp");
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some("gif");
    }
    None
}

/// Copies a user-picked image into `directory` and returns its path. The
/// filename carries a timestamp so replacing a cover yields a new URL and the
/// previously rendered image can't be served from cache.
fn import_artwork_into(
    directory: &Path,
    game_id: &str,
    source_path: &str,
    now_millis: u128,
) -> Result<String, String> {
    if !is_valid_identifier(game_id) {
        return Err("Invalid game identifier".to_string());
    }
    let source = expand_home_path(source_path.trim());
    let metadata = fs::metadata(&source)
        .map_err(|_| format!("Image '{}' was not found.", source.display()))?;
    if !metadata.is_file() {
        return Err("The selected artwork path is not a file.".to_string());
    }
    const MAX_ARTWORK_SIZE: u64 = 8 * 1024 * 1024;
    if metadata.len() > MAX_ARTWORK_SIZE {
        return Err("Artwork exceeds the 8 MiB safety limit".to_string());
    }

    let bytes = fs::read(&source).map_err(|error| format!("Failed to read artwork: {error}"))?;
    let extension = image_extension_from_bytes(&bytes)
        .ok_or_else(|| "Unsupported image format. Use PNG, JPEG, WebP or GIF.".to_string())?;

    fs::create_dir_all(directory)
        .map_err(|error| format!("Failed to create artwork cache: {error}"))?;

    let prefix = format!("{game_id}-custom-");
    if let Ok(entries) = fs::read_dir(directory) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with(&prefix) || name.starts_with(&format!(".{prefix}")) {
                let _ = fs::remove_file(entry.path());
            }
        }
    }

    let path = directory.join(format!("{prefix}{now_millis}.{extension}"));
    let temporary = directory.join(format!(".{prefix}{now_millis}.{extension}.tmp"));
    fs::write(&temporary, &bytes).map_err(|error| format!("Failed to save artwork: {error}"))?;
    fs::rename(&temporary, &path)
        .map_err(|error| format!("Failed to publish artwork: {error}"))?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn import_artwork_file(
    app: tauri::AppHandle,
    game_id: String,
    source_path: String,
) -> Result<String, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve artwork cache: {error}"))?
        .join("artwork");
    let now = std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    import_artwork_into(&directory, &game_id, &source_path, now)
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
                    let name = entry.file_name().to_string_lossy().to_lowercase();
                    if matches!(
                        name.as_str(),
                        "docs" | "documentation" | "capture" | "drivers" | "saves" | "__macosx"
                    ) {
                        continue;
                    }
                    visit_dir(&path, candidates, depth + 1);
                } else if path.is_file() {
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                        let ext_lower = ext.to_lowercase();
                        if ext_lower == "exe" || ext_lower == "bat" || ext_lower == "com" {
                            let fname = path
                                .file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("")
                                .to_ascii_lowercase();
                            if !SUPPORT_BINARIES.contains(&fname.as_str())
                                && !AUXILIARY_PROGRAMS.contains(&fname.as_str())
                            {
                                candidates.push(path);
                            }
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

    // 1. Check if executable matches folder name (e.g. ALBION/ALBION.EXE)
    let parent_matching = exe_candidates.iter().find(|path| {
        let stem = path.file_stem().and_then(|name| name.to_str());
        let parent = path
            .parent()
            .and_then(Path::file_name)
            .and_then(|name| name.to_str());
        matches!((stem, parent), (Some(stem), Some(parent)) if stem.eq_ignore_ascii_case(parent))
    });
    if let Some(matching) = parent_matching {
        return Some(executable_parts(game_dir, matching));
    }

    // 2. Check if executable matches game directory root stem (e.g. Albion_CD_Czech -> albion.exe)
    let game_dir_stem = game_dir
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");
    let game_dir_words: Vec<String> = game_dir_stem
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| w.len() >= 3)
        .map(|w| w.to_ascii_lowercase())
        .collect();
    if let Some(game_name_match) = exe_candidates.iter().find(|path| {
        let stem = path
            .file_stem()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        game_dir_words.iter().any(|w| stem == *w || stem.starts_with(w))
    }) {
        return Some(executable_parts(game_dir, game_name_match));
    }

    // 3. Specific top game binary names
    let specific_priority_names = [
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
        "dune2.exe",
        "civ.exe",
        "war.exe",
        "albion.exe",
    ];
    for p in specific_priority_names {
        if let Some(matching) = exe_candidates.iter().find(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .map(|name| name.eq_ignore_ascii_case(p))
                .unwrap_or(false)
        }) {
            return Some(executable_parts(game_dir, matching));
        }
    }

    // 4. Fallback generic launcher names (play.bat, start.exe, run.bat, etc.)
    let fallback_names = [
        "play.bat",
        "start.exe",
        "run.bat",
        "go.bat",
        "game.exe",
        "main.exe",
    ];
    for p in fallback_names {
        if let Some(matching) = exe_candidates.iter().find(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .map(|name| name.eq_ignore_ascii_case(p))
                .unwrap_or(false)
        }) {
            return Some(executable_parts(game_dir, matching));
        }
    }

    // 5. Default to the first found candidate
    Some(executable_parts(game_dir, &exe_candidates[0]))
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

fn detect_archive_format(path: &Path) -> Option<String> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();

    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();

    if let Ok(mut file) = File::open(path) {
        let mut header = [0_u8; 8];
        let bytes_read = file.read(&mut header).unwrap_or(0);
        if bytes_read >= 4 {
            if matches!(
                &header[..4],
                [0x50, 0x4b, 0x03, 0x04] | [0x50, 0x4b, 0x05, 0x06] | [0x50, 0x4b, 0x07, 0x08]
            ) {
                return Some("zip".to_string());
            }
            if bytes_read >= 6 && &header[..6] == b"7z\xbc\xaf\x27\x1c" {
                return Some("7z".to_string());
            }
            // macOS installer package (xar container), as used by GOG's Mac builds.
            if &header[..4] == b"xar!" {
                return Some("pkg".to_string());
            }
            if bytes_read >= 7
                && (&header[..7] == b"Rar!\x1a\x07\x00" || &header[..7] == b"Rar!\x1a\x07\x01")
            {
                return Some("rar".to_string());
            }
            if &header[..2] == b"\x60\xea" {
                return Some("arj".to_string());
            }
            if bytes_read >= 5 && &header[..2] == b"-l" && &header[4..5] == b"-" {
                return Some("lha".to_string());
            }
            if &header[..2] == b"MZ" {
                let _ = file.seek(SeekFrom::Start(0));
                if ZipArchive::new(&mut file).is_ok() {
                    return Some("sfx_exe".to_string());
                }
                // Scan buffer for 7z or RAR SFX headers
                let _ = file.seek(SeekFrom::Start(0));
                let mut buffer = vec![0_u8; 1024 * 512];
                if let Ok(read_len) = file.read(&mut buffer) {
                    if buffer[..read_len]
                        .windows(21)
                        .any(|w| w == b"Inno Setup Setup Data")
                    {
                        return Some("inno".to_string());
                    }
                    if buffer[..read_len].windows(6).any(|w| w == b"7z\xbc\xaf\x27\x1c") {
                        return Some("sfx_7z".to_string());
                    }
                    if buffer[..read_len].windows(4).any(|w| w == b"Rar!") {
                        return Some("sfx_rar".to_string());
                    }
                }
                if name.contains("package") || name.contains("sfx") {
                    return Some("sfx_exe".to_string());
                }
            }
        }
    }

    match ext.as_str() {
        "zip" => Some("zip".to_string()),
        "7z" => Some("7z".to_string()),
        "rar" => Some("rar".to_string()),
        "arj" => Some("arj".to_string()),
        "lha" | "lzh" => Some("lha".to_string()),
        "pkg" => Some("pkg".to_string()),
        _ => {
            if name.contains("package.exe") || name.contains(".sfx.exe") {
                Some("sfx_exe".to_string())
            } else {
                None
            }
        }
    }
}

pub struct GogLayout {
    pub title: Option<String>,
    pub executable: Option<String>,
    pub cd_rom_path: Option<String>,
}

/// GOG DOS releases unpack to a flat game root alongside `goggame-<id>.info`
/// (launch metadata), a raw CUE/BIN disc image (`game.ins` + `game.gog`), and
/// Windows-installer scaffolding that DOSBox has no use for.
fn detect_gog_layout(root: &Path) -> Option<GogLayout> {
    let entries = fs::read_dir(root).ok()?;
    let mut info_file = None;
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with("goggame-") && name.ends_with(".info") {
            info_file = Some(entry.path());
            break;
        }
    }
    let info_file = info_file?;

    let mut layout = GogLayout {
        title: None,
        executable: None,
        cd_rom_path: None,
    };

    if let Ok(content) = fs::read_to_string(&info_file) {
        if let Ok(info) = serde_json::from_str::<serde_json::Value>(&content) {
            layout.title = info
                .get("name")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
        }
    }

    // GOG's own launcher runs DOSBox, so its playTasks point at dosbox.exe rather
    // than the DOS binary. Take the executable from the bundled DOSBox autoexec.
    if let Some(conf_exe) = find_gog_autoexec_executable(root) {
        layout.executable = Some(conf_exe);
    }

    let ins = root.join("game.ins");
    if ins.is_file() {
        layout.cd_rom_path = Some(ins.to_string_lossy().to_string());
    }

    Some(layout)
}

/// Reads the DOS executable out of the `[autoexec]` block in GOG's bundled
/// `dosbox_*.conf` files, skipping the mount/menu plumbing around it.
fn find_gog_autoexec_executable(root: &Path) -> Option<String> {
    let support = root.join("__support").join("app");
    let entries = fs::read_dir(&support).ok()?;
    let mut confs: Vec<PathBuf> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            p.extension()
                .and_then(|e| e.to_str())
                .map(|e| e.eq_ignore_ascii_case("conf"))
                .unwrap_or(false)
        })
        .collect();
    // `*_single.conf` carries the launcher menu; prefer it over the base config.
    confs.sort_by_key(|p| {
        !p.file_name()
            .and_then(|n| n.to_str())
            .map(|n| n.to_ascii_lowercase().contains("single"))
            .unwrap_or(false)
    });

    for conf in confs {
        let Ok(content) = fs::read_to_string(&conf) else {
            continue;
        };
        let mut in_autoexec = false;
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with('[') {
                in_autoexec = trimmed.eq_ignore_ascii_case("[autoexec]");
                continue;
            }
            if !in_autoexec || trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }
            let lower = trimmed.to_ascii_lowercase();
            if lower.ends_with(".exe") || lower.ends_with(".bat") || lower.ends_with(".com") {
                let candidate = trimmed.split_whitespace().next().unwrap_or(trimmed);
                let candidate_lower = candidate.to_ascii_lowercase();
                let is_plumbing = candidate_lower.contains("dosbox")
                    || candidate_lower.starts_with("setup")
                    || candidate_lower.contains('\\')
                    || candidate_lower.contains('/');
                if !is_plumbing && root.join(candidate).is_file() {
                    return Some(candidate.to_string());
                }
            }
        }
    }
    None
}

/// Moves everything from `source` into `destination`, merging directories and
/// replacing files that already exist. Used where one tree has to be folded
/// into another without losing either side's extra content.
fn merge_directory_into(source: &Path, destination: &Path) -> std::io::Result<()> {
    fs::create_dir_all(destination)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let from = entry.path();
        let to = destination.join(entry.file_name());

        // symlink_metadata describes the link itself. Following it here would
        // recurse into the target and move its contents out — that guts bundles
        // built from symlinked directories, as macOS frameworks are.
        let is_real_dir = fs::symlink_metadata(&from)?.file_type().is_dir();

        if is_real_dir {
            // Clears a file or symlink sitting where the directory must go.
            remove_existing_target(&to)?;
            merge_directory_into(&from, &to)?;
            let _ = fs::remove_dir(&from);
        } else {
            remove_existing_target(&to)?;
            // rename moves a symlink as the link itself, which is what we want.
            // It fails across devices, so fall back to copying.
            if fs::rename(&from, &to).is_err() {
                fs::copy(&from, &to)?;
                let _ = fs::remove_file(&from);
            }
        }
    }
    Ok(())
}

/// Clears whatever sits at `path` so an incoming entry can take its place.
/// Returns whether anything was removed. A directory is kept when the incoming
/// entry is also a directory, so the two can be merged instead of replaced.
fn remove_existing_target(path: &Path) -> std::io::Result<bool> {
    let Ok(metadata) = fs::symlink_metadata(path) else {
        return Ok(false);
    };
    if metadata.file_type().is_dir() {
        return Ok(false);
    }
    // A symlink is removed as the link, never followed.
    fs::remove_file(path)?;
    Ok(true)
}

/// Folds GOG's `app` payload into the game directory and removes the Windows
/// installer scaffolding around it.
///
/// `app` is not scaffolding: GOG's own script installs it as supportData with
/// `{supportDir}/app` -> `{app}`, and for some releases it carries live game
/// state (Albion keeps `XLDLIBS/CURRENT` and `SAVES` only there). Deleting it
/// would strip files the game needs, so it is merged in rather than dropped.
fn prune_gog_installer_scaffolding(root: &Path) {
    let support_data = root.join("app");
    if support_data.is_dir() {
        if merge_directory_into(&support_data, root).is_ok() {
            let _ = fs::remove_dir_all(&support_data);
        }
    }
    for name in ["tmp", "__redist", "commonappdata"] {
        let path = root.join(name);
        if path.is_dir() {
            let _ = fs::remove_dir_all(&path);
        }
    }
}

fn flatten_single_root_folder(destination: &Path) -> Result<(), String> {
    let entries = fs::read_dir(destination)
        .map_err(|e| format!("Failed to read destination directory: {e}"))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            !name.starts_with('.') && name != "__MACOSX"
        })
        .collect::<Vec<_>>();

    if entries.len() == 1 && entries[0].path().is_dir() {
        let single_subdir = entries[0].path();
        let sub_entries = fs::read_dir(&single_subdir)
            .map_err(|e| format!("Failed to read nested directory: {e}"))?
            .filter_map(|entry| entry.ok())
            .collect::<Vec<_>>();

        for sub_entry in sub_entries {
            let src = sub_entry.path();
            let dest = destination.join(sub_entry.file_name());
            if !dest.exists() {
                let _ = fs::rename(&src, &dest);
            }
        }
        let _ = fs::remove_dir_all(&single_subdir);
    }
    Ok(())
}

#[tauri::command]
fn scan_game_archives(game_dir: String) -> Result<Vec<DiscoveredArchiveItem>, String> {
    let root = expand_home_path(game_dir.trim());
    if !root.exists() {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();

    if root.is_file() {
        if let Some(fmt) = detect_archive_format(&root) {
            let size_bytes = fs::metadata(&root).map(|m| m.len()).unwrap_or(0);
            results.push(DiscoveredArchiveItem {
                file_name: root.file_name().unwrap_or_default().to_string_lossy().to_string(),
                file_path: root.to_string_lossy().to_string(),
                relative_path: root.file_name().unwrap_or_default().to_string_lossy().to_string(),
                format: fmt,
                size_bytes,
            });
        }
        return Ok(results);
    }

    fn visit_archives(
        base: &Path,
        directory: &Path,
        depth: usize,
        results: &mut Vec<DiscoveredArchiveItem>,
    ) {
        if depth > 4 {
            return;
        }
        let Ok(entries) = fs::read_dir(directory) else {
            return;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || name == "__MACOSX" {
                continue;
            }
            if path.is_dir() {
                visit_archives(base, &path, depth + 1, results);
            } else if path.is_file() {
                if let Some(fmt) = detect_archive_format(&path) {
                    let size_bytes = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                    let relative_path = path
                        .strip_prefix(base)
                        .unwrap_or(&path)
                        .to_string_lossy()
                        .to_string();
                    results.push(DiscoveredArchiveItem {
                        file_name: name,
                        file_path: path.to_string_lossy().to_string(),
                        relative_path,
                        format: fmt,
                        size_bytes,
                    });
                }
            }
        }
    }

    visit_archives(&root, &root, 0, &mut results);
    results.sort_by(|a, b| a.file_name.to_lowercase().cmp(&b.file_name.to_lowercase()));
    Ok(results)
}

fn try_extract_with_cli(tool_name: &str, args: &[&str]) -> bool {
    let candidate_paths = [
        tool_name.to_string(),
        format!("/opt/homebrew/bin/{}", tool_name),
        format!("/usr/local/bin/{}", tool_name),
        format!("/usr/bin/{}", tool_name),
    ];
    for bin in &candidate_paths {
        if let Ok(status) = Command::new(bin).args(args).status() {
            if status.success() {
                return true;
            }
        }
    }
    false
}

/// Unpacks a macOS installer package (xar) as shipped by GOG. The game lives in
/// a gzipped cpio payload inside, and the useful part is the `Resources/game`
/// folder of the wrapped .app — the surrounding bundle is launcher plumbing.
fn extract_macos_pkg(archive: &Path, destination: &Path) -> Result<(), String> {
    let staging = destination.join(".pkg-staging");
    let _ = fs::remove_dir_all(&staging);
    fs::create_dir_all(&staging)
        .map_err(|e| format!("Failed to create staging directory: {e}"))?;

    let xar_ok = Command::new("/usr/bin/xar")
        .arg("-xf")
        .arg(archive)
        .arg("-C")
        .arg(&staging)
        .status()
        .map(|s| s.success())
        .unwrap_or(false);
    if !xar_ok {
        let _ = fs::remove_dir_all(&staging);
        return Err("Failed to open the .pkg archive.".to_string());
    }

    let mut payloads = Vec::new();
    fn find_payloads(dir: &Path, out: &mut Vec<PathBuf>, depth: usize) {
        if depth > 3 {
            return;
        }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    find_payloads(&path, out, depth + 1);
                } else if matches!(
                    path.file_name().and_then(|n| n.to_str()),
                    Some("Scripts") | Some("Payload")
                ) {
                    out.push(path);
                }
            }
        }
    }
    find_payloads(&staging, &mut payloads, 0);
    if payloads.is_empty() {
        let _ = fs::remove_dir_all(&staging);
        return Err("The .pkg contains no installable payload.".to_string());
    }

    let unpacked = staging.join("unpacked");
    fs::create_dir_all(&unpacked)
        .map_err(|e| format!("Failed to create payload directory: {e}"))?;
    let mut any = false;
    for payload in &payloads {
        // Payloads are gzipped cpio; cpio reads stdin and writes into its cwd.
        let script = format!(
            "gunzip -c {} | cpio -i --quiet 2>/dev/null",
            shell_single_quote(&payload.to_string_lossy())
        );
        let ok = Command::new("/bin/sh")
            .arg("-c")
            .arg(&script)
            .current_dir(&unpacked)
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        any |= ok;
    }
    if !any {
        let _ = fs::remove_dir_all(&staging);
        return Err("Failed to unpack the .pkg payload.".to_string());
    }

    // Prefer the wrapped app's game folder; fall back to the whole payload.
    let mut game_root = None;
    fn find_game_dir(dir: &Path, out: &mut Option<PathBuf>, depth: usize) {
        if out.is_some() || depth > 6 {
            return;
        }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                if path.file_name().and_then(|n| n.to_str()) == Some("game")
                    && path
                        .parent()
                        .and_then(|p| p.file_name())
                        .and_then(|n| n.to_str())
                        == Some("Resources")
                {
                    *out = Some(path);
                    return;
                }
                find_game_dir(&path, out, depth + 1);
            }
        }
    }
    find_game_dir(&unpacked, &mut game_root, 0);
    let source_root = game_root.unwrap_or(unpacked);

    // Keep the staging tree if the merge fails, so a partial move does not
    // destroy the payload the user would otherwise have to re-extract.
    merge_directory_into(&source_root, destination).map_err(|e| {
        format!(
            "Failed to move the unpacked game into place: {e}. The unpacked files were kept at '{}'.",
            staging.display()
        )
    })?;
    let _ = fs::remove_dir_all(&staging);
    Ok(())
}

fn shell_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', r"'\''"))
}

#[tauri::command]
fn unpack_game_archive(
    archive_path: String,
    destination_folder: String,
    flatten_single_root: bool,
    delete_archive_after: bool,
) -> Result<UnpackArchiveResult, String> {
    let archive_p = expand_home_path(archive_path.trim());
    let dest_p = expand_home_path(destination_folder.trim());
    if !archive_p.is_file() {
        return Err(format!(
            "Archive file '{}' was not found.",
            archive_p.display()
        ));
    }
    fs::create_dir_all(&dest_p).map_err(|e| {
        format!(
            "Failed to create destination directory '{}': {e}",
            dest_p.display()
        )
    })?;

    let zip_res = extract_zip_safely(&archive_p, &dest_p);
    if zip_res.is_err() {
        let dest_str = dest_p.to_string_lossy().to_string();
        let archive_str = archive_p.to_string_lossy().to_string();

        let mut extracted = false;

        // 0. macOS .pkg (xar) — its payload needs a different pipeline entirely.
        if detect_archive_format(&archive_p).as_deref() == Some("pkg") {
            extract_macos_pkg(&archive_p, &dest_p)?;
            extracted = true;
        }

        // 1. Try innoextract (specialized for OldGames.sk and Inno Setup Windows packages)
        if !extracted {
            extracted = try_extract_with_cli("innoextract", &["--extract", "--output-dir", &dest_str, &archive_str])
                || try_extract_with_cli("innoextract", &["-e", "-d", &dest_str, &archive_str]);
        }

        // 2. Try 7z / 7zz / 7za
        if !extracted {
            let out_arg = format!("-o{}", dest_str);
            extracted = try_extract_with_cli("7z", &["x", "-y", &out_arg, &archive_str])
                || try_extract_with_cli("7zz", &["x", "-y", &out_arg, &archive_str])
                || try_extract_with_cli("7za", &["x", "-y", &out_arg, &archive_str]);
        }

        // 3. Try unar
        if !extracted {
            extracted = try_extract_with_cli("unar", &["-force-overwrite", "-output-directory", &dest_str, &archive_str]);
        }

        // 4. Try tar / unzip
        if !extracted {
            extracted = try_extract_with_cli("tar", &["-xf", &archive_str, "-C", &dest_str]);
        }

        if !extracted {
            let filename = archive_p.file_name().unwrap_or_default().to_string_lossy();
            let is_inno_or_sfx = filename.to_lowercase().contains("package") || filename.to_lowercase().ends_with(".exe");
            let hint = if is_inno_or_sfx {
                "\n\nThis is a Windows package installer (GOG / Inno Setup / OldGames.sk format).\nTo extract this format automatically on macOS, install innoextract via Homebrew:\n  brew install innoextract\n\nOr extract its contents into the game folder manually."
            } else {
                "\n\nTo unpack 7z/RAR archives on macOS, install 7-Zip via Homebrew:\n  brew install sevenzip"
            };
            return Err(format!(
                "Failed to unpack '{}'.{}",
                filename,
                hint
            ));
        }
    }

    if flatten_single_root {
        let _ = flatten_single_root_folder(&dest_p);
    }

    if delete_archive_after {
        let _ = fs::remove_file(&archive_p);
    }

    let gog_layout = detect_gog_layout(&dest_p);
    if gog_layout.is_some() {
        prune_gog_installer_scaffolding(&dest_p);
    }

    let mut files = Vec::new();
    collect_executable_files(&dest_p, 0, &mut files);
    let mut candidates = files
        .iter()
        .map(|path| score_executable(&dest_p, path))
        .collect::<Vec<_>>();
    candidates.sort_by(|left, right| {
        right
            .score
            .cmp(&left.score)
            .then_with(|| left.absolute_path.cmp(&right.absolute_path))
    });

    let best_game = candidates.iter().find(|c| c.role == "game");
    let (mut disc_exe, mut disc_work) = match best_game {
        Some(c) => (Some(c.executable.clone()), Some(c.working_dir.clone())),
        None => (None, None),
    };

    let installers = candidates
        .into_iter()
        .filter(|c| c.role == "installer" || c.role == "configuration")
        .collect::<Vec<_>>();

    let mut cd_media = discover_cd_media(&dest_p);

    // GOG ships the launch target and disc image explicitly; trust that over heuristics.
    if let Some(layout) = &gog_layout {
        if let Some(exe) = &layout.executable {
            disc_exe = Some(exe.clone());
            disc_work = Some(String::new());
        }
        if let Some(cd) = &layout.cd_rom_path {
            cd_media = Some(cd.clone());
        }
    }

    // A package can unpack cleanly yet hold nothing DOSBox can run — GOG's Mac
    // builds of ScummVM titles are the common case. Say so instead of leaving
    // the caller with a game entry that has no executable.
    let engine_note = if files.is_empty() {
        let scummvm = dest_p.join("scummvm").exists() || dest_p.join("game").join("configfile").is_file();
        if scummvm {
            Some(" No DOS executable was found — this release runs on ScummVM, which this launcher does not drive.")
        } else {
            Some(" No DOS executable was found in this package.")
        }
    } else {
        None
    };

    let message = match gog_layout.as_ref().and_then(|l| l.title.as_ref()) {
        Some(title) => format!("Unpacked GOG release '{title}' into '{}'.", dest_p.display()),
        None => format!("Successfully unpacked archive into '{}'.", dest_p.display()),
    };
    let message = match engine_note {
        Some(note) => format!("{message}{note}"),
        None => message,
    };

    Ok(UnpackArchiveResult {
        success: true,
        message,
        extracted_files_count: files.len(),
        discovered_executable: disc_exe,
        discovered_working_dir: disc_work,
        discovered_cd_rom_path: cd_media,
        discovered_title: gog_layout.and_then(|l| l.title),
        installer_candidates: installers,
    })
}

#[tauri::command]
fn ensure_dos_tools(app: tauri::AppHandle) -> Result<String, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {e}"))?;
    let tools_dir = app_data.join("dos-tools");
    fs::create_dir_all(&tools_dir)
        .map_err(|e| format!("Failed to create dos-tools directory: {e}"))?;

    let nc_bat = tools_dir.join("NC.BAT");
    if !nc_bat.exists() {
        let nc_bat_content = "@echo off\r\n\
if exist y:\\nc.exe (\r\n\
    y:\\nc.exe\r\n\
    goto end\r\n\
)\r\n\
if exist y:\\vc.com (\r\n\
    y:\\vc.com\r\n\
    goto end\r\n\
)\r\n\
if exist y:\\dn.com (\r\n\
    y:\\dn.com\r\n\
    goto end\r\n\
)\r\n\
if exist c:\\nc\\nc.exe (\r\n\
    c:\\nc\\nc.exe\r\n\
    goto end\r\n\
)\r\n\
if exist c:\\vc\\vc.com (\r\n\
    c:\\vc\\vc.com\r\n\
    goto end\r\n\
)\r\n\
echo ====================================================\r\n\
echo   GameSky.space - DOS File Manager Tools (Drive Y:)\r\n\
echo ====================================================\r\n\
echo.\r\n\
echo To use Norton Commander or Volkov Commander:\r\n\
echo Copy NC.EXE or VC.COM into this tools folder (Y:\\)\r\n\
echo or configure a custom path in Settings.\r\n\
echo.\r\n\
echo Current drive C: contains the game files.\r\n\
echo.\r\n\
dir /w\r\n\
:end\r\n";
        let _ = fs::write(&nc_bat, nc_bat_content);
    }

    let readme = tools_dir.join("README.TXT");
    if !readme.exists() {
        let readme_content = "GameSky.space - DOS Tools Directory\r\n\
=====================================\r\n\
\r\n\
Files in this folder are mounted as Drive Y:\\ in DOSBox.\r\n\
\r\n\
You can copy your own retro utilities here:\r\n\
- NC.EXE (Norton Commander)\r\n\
- VC.COM (Volkov Commander)\r\n\
- DN.COM (DOS Navigator)\r\n\
- PKUNZIP.EXE, ARJ.EXE, UNRAR.EXE (DOS Archivers)\r\n\
";
        let _ = fs::write(&readme, readme_content);
    }

    Ok(tools_dir.to_string_lossy().to_string())
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

/// Programs shipped with DOS games that are not the game: manuals, catalogues
/// and order forms. They can be run, so they stay in the pick list, but they
/// must never win automatic selection — HELP.EXE inside a HELP folder used to,
/// because the name matched its directory.
const AUXILIARY_PROGRAMS: [&str; 9] = [
    "help.exe",
    "readme.exe",
    "manual.exe",
    "order.exe",
    "vendor.exe",
    "catalog.exe",
    "view.exe",
    "license.exe",
    "orderfrm.exe",
];

/// Runtime helpers shipped beside DOS games that are never the launch target.
const SUPPORT_BINARIES: [&str; 8] = [
    "dos4gw.exe",
    "dos32a.exe",
    "cwspdm.exe",
    "cwsdpmi.exe",
    "pmodew.exe",
    "unins000.exe",
    "setsound.exe",
    "uninstall.exe",
];

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

    // DOS extenders and driver helpers sit next to the game and share its
    // score, so without this they can outrank the real launcher on name order.
    if SUPPORT_BINARIES.contains(&lower.as_str()) {
        score -= 900;
        role = "windows".to_string();
        reasons.push("runtime support binary, not a game");
    } else if AUXILIARY_PROGRAMS.contains(&lower.as_str()) {
        score -= 500;
        role = "documentation".to_string();
        reasons.push("manual or utility, not the game");
    } else if ["uninst", "uninstall", "remove"]
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

    let wdir_str = relative_working_dir.to_string_lossy().to_string();
    let wdir_normalized = wdir_str.replace('\\', "/");
    let exe_str = relative_executable.to_string_lossy().to_string();

    // Detect OldGames.sk-style package layout where game_dir contains a "C" subfolder
    // that represents the C: drive root (e.g. Albion_CD_Czech/C/ALBION/ALBION.EXE).
    // The original dosbox.play.conf does: mount C C / cd ALBION / ALBION.EXE
    // We must replicate this: mount C: on the "C" subfolder, strip "C\" from working_dir.
    let c_subfolder = canonical_root.join("C");
    let is_oldgames_layout = c_subfolder.is_dir()
        && (wdir_normalized.starts_with("C/") || wdir_normalized.eq_ignore_ascii_case("C"));

    if is_oldgames_layout {
        let effective_root: PathBuf = c_subfolder.canonicalize().unwrap_or(c_subfolder);
        let stripped_wdir = if wdir_normalized.len() > 2 {
            wdir_normalized[2..].to_string()
        } else {
            String::new()
        };

        let launch_dir = effective_root.join(&stripped_wdir);
        let canonical_launch_dir = launch_dir.canonicalize().map_err(|_| {
            format!(
                "The game working directory '{}' does not exist.",
                launch_dir.display()
            )
        })?;
        if !canonical_launch_dir.is_dir() || !canonical_launch_dir.starts_with(&canonical_root) {
            return Err(
                "The game working directory is outside the installed game folder.".to_string(),
            );
        }

        let executable_path = canonical_launch_dir.join(&exe_str);
        let canonical_executable = executable_path.canonicalize().map_err(|_| {
            format!(
                "Executable '{}' was not found. Reinstall the game from Catalog or edit its profile.",
                executable_path.display()
            )
        })?;
        if !canonical_executable.is_file() || !canonical_executable.starts_with(&canonical_root) {
            return Err(
                "The configured executable is outside the installed game folder.".to_string(),
            );
        }

        let prepared_cd_rom = if !cd_rom_path.trim().is_empty() {
            let cd_path = expand_home_path(cd_rom_path.trim());
            if cd_path.exists() {
                cd_path
                    .canonicalize()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|_| cd_path.to_string_lossy().to_string())
            } else {
                discover_cd_media(&canonical_root).unwrap_or_default()
            }
        } else {
            discover_cd_media(&canonical_root).unwrap_or_default()
        };

        harmonize_game_cd_config(&canonical_launch_dir, is_real_cd_media(&prepared_cd_rom, &canonical_root));

        return Ok(PreparedGameLaunch {
            c_drive_path: effective_root.to_string_lossy().to_string(),
            working_dir: stripped_wdir.replace('/', "\\"),
            executable: exe_str.replace('/', "\\"),
            cd_rom_path: prepared_cd_rom,
        });
    }

    // Standard layout: collapse working_dir into c_drive_path (mount exe dir as C:)
    let launch_dir = canonical_root.join(&wdir_normalized);
    let canonical_launch_dir = launch_dir.canonicalize().map_err(|_| {
        format!(
            "The game working directory '{}' does not exist.",
            launch_dir.display()
        )
    })?;
    if !canonical_launch_dir.is_dir() || !canonical_launch_dir.starts_with(&canonical_root) {
        return Err("The game working directory is outside the installed game folder.".to_string());
    }

    let executable_path = canonical_launch_dir.join(&exe_str);
    let canonical_executable = executable_path.canonicalize().map_err(|_| {
        format!(
            "Executable '{}' was not found. Reinstall the game from Catalog or edit its profile.",
            executable_path.display()
        )
    })?;
    if !canonical_executable.is_file() || !canonical_executable.starts_with(&canonical_root) {
        return Err("The configured executable is outside the installed game folder.".to_string());
    }

    let prepared_cd_rom = if !cd_rom_path.trim().is_empty() {
        let cd_path = expand_home_path(cd_rom_path.trim());
        if cd_path.exists() {
            cd_path
                .canonicalize()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| cd_path.to_string_lossy().to_string())
        } else {
            discover_cd_media(&canonical_root).unwrap_or_default()
        }
    } else {
        discover_cd_media(&canonical_root).unwrap_or_default()
    };

    harmonize_game_cd_config(&canonical_launch_dir, is_real_cd_media(&prepared_cd_rom, &canonical_root));

    Ok(PreparedGameLaunch {
        c_drive_path: canonical_launch_dir.to_string_lossy().to_string(),
        working_dir: String::new(),
        executable: exe_str.replace('/', "\\"),
        cd_rom_path: prepared_cd_rom,
    })
}

fn clean_game_package_title(name: &str) -> String {
    let mut s = name.to_string();
    for ext in &[".exe", ".zip", ".7z", ".rar", ".arj", ".lha", ".lzh", ".tar.gz"] {
        if s.to_ascii_lowercase().ends_with(ext) {
            s = s[..s.len() - ext.len()].to_string();
            break;
        }
    }
    s = s.replace("-Package", "")
        .replace(".Package", "")
        .replace("_Package", "")
        .replace("Package", "")
        .replace("www.oldgames.sk", "")
        .replace("oldgames.sk", "")
        .replace(['_', '.', '-'], " ");
    let cleaned = s.split_whitespace().collect::<Vec<_>>().join(" ");
    if cleaned.is_empty() {
        name.to_string()
    } else {
        cleaned
    }
}

fn clean_game_package_folder_name(name: &str) -> String {
    let title = clean_game_package_title(name);
    let mut folder = title
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect::<String>();
    while folder.contains("__") {
        folder = folder.replace("__", "_");
    }
    let res = folder.trim_matches('_').to_string();
    if res.is_empty() {
        "GAME".to_string()
    } else {
        res
    }
}

fn is_placeholder_cd_dir(dir: &Path) -> bool {
    let Ok(entries) = fs::read_dir(dir) else {
        return true;
    };
    let mut file_count = 0;
    let mut total_bytes = 0u64;
    for entry in entries.flatten() {
        if let Ok(meta) = entry.metadata() {
            if meta.is_file() {
                file_count += 1;
                total_bytes += meta.len();
            } else if meta.is_dir() {
                return false;
            }
        }
    }
    file_count <= 2 && total_bytes < 100_000
}

/// Points a game's own config at the CD we are about to mount as D:.
///
/// This rewrites files the user owns, so it is deliberately conservative:
/// it only runs when a CD is actually being mounted, matches the CD-path keys
/// exactly rather than by prefix (`CDROM_SPEED` is not a CD path), and keeps a
/// one-time `.gamesky-backup` of the original so the shipped value can be
/// recovered.
/// Whether `prepared_cd_rom` names real CD media rather than discover_cd_media's
/// last-resort fallback, which simply hands back the game directory itself.
fn is_real_cd_media(prepared_cd_rom: &str, game_root: &Path) -> bool {
    let trimmed = prepared_cd_rom.trim();
    if trimmed.is_empty() {
        return false;
    }
    Path::new(trimmed) != game_root
}

fn harmonize_game_cd_config(launch_dir: &Path, cd_is_mounted: bool) {
    if !cd_is_mounted {
        return;
    }
    const CD_PATH_KEYS: [&str; 4] = ["SOURCE_PATH", "CD_PATH", "CDROM", "CD_DRIVE"];

    let Ok(entries) = fs::read_dir(launch_dir) else {
        return;
    };
    for entry in entries.flatten() {
        let p = entry.path();
        let Some(ext) = p.extension().and_then(|e| e.to_str()) else {
            continue;
        };
        if !(ext.eq_ignore_ascii_case("ini") || ext.eq_ignore_ascii_case("cfg")) {
            continue;
        }
        let Ok(content) = fs::read_to_string(&p) else {
            continue;
        };

        let mut modified = false;
        let mut new_lines = Vec::new();
        for line in content.lines() {
            let trimmed = line.trim();
            let key = trimmed.split('=').next().unwrap_or("").trim();
            let is_cd_path = trimmed.contains('=')
                && CD_PATH_KEYS
                    .iter()
                    .any(|candidate| key.eq_ignore_ascii_case(candidate));
            if is_cd_path {
                let replacement = format!("{key} = D:\\");
                if line != replacement {
                    modified = true;
                }
                new_lines.push(replacement);
                continue;
            }
            new_lines.push(line.to_string());
        }
        if !modified {
            continue;
        }

        let backup = p.with_extension(format!("{ext}.gamesky-backup"));
        if !backup.exists() {
            let _ = fs::copy(&p, &backup);
        }
        let _ = fs::write(&p, new_lines.join("\r\n"));
    }
}

fn discover_cd_media(game_dir: &Path) -> Option<String> {
    if !game_dir.exists() {
        return None;
    }

    // 0. Check if an embedded dosbox.conf specifies a CD mount
    let mut conf_files = Vec::new();
    fn find_confs(dir: &Path, list: &mut Vec<PathBuf>, depth: usize) {
        if depth > 4 {
            return;
        }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    find_confs(&p, list, depth + 1);
                } else if p.is_file() {
                    if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                        if ext.eq_ignore_ascii_case("conf") {
                            list.push(p);
                        }
                    }
                }
            }
        }
    }
    find_confs(game_dir, &mut conf_files, 0);

    for conf_p in conf_files {
        if let Ok(content) = fs::read_to_string(&conf_p) {
            let mut in_autoexec = false;
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with('[') {
                    in_autoexec = trimmed.eq_ignore_ascii_case("[autoexec]");
                    continue;
                }
                if !in_autoexec || trimmed.is_empty() || trimmed.starts_with('#') {
                    continue;
                }
                let lower = trimmed.to_lowercase();
                if lower.starts_with("mount d ") || lower.starts_with("imgmount d ") {
                    let extracted_path = if let Some(start_q) = trimmed.find('"') {
                        if let Some(end_q) = trimmed[start_q + 1..].find('"') {
                            Some(trimmed[start_q + 1..start_q + 1 + end_q].to_string())
                        } else {
                            None
                        }
                    } else {
                        let parts: Vec<&str> = trimmed.split_whitespace().collect();
                        if parts.len() >= 3 {
                            Some(parts[2].to_string())
                        } else {
                            None
                        }
                    };

                    if let Some(rel) = extracted_path {
                        let rel_clean = rel
                            .trim_start_matches('.')
                            .trim_start_matches('/')
                            .trim_start_matches('\\');
                        let candidate1 = game_dir.join(rel_clean);
                        if candidate1.exists() && !is_placeholder_cd_dir(&candidate1) {
                            return Some(candidate1.to_string_lossy().to_string());
                        }
                        if let Some(parent) = conf_p.parent() {
                            let candidate2 = parent.join(rel_clean);
                            if candidate2.exists() && !is_placeholder_cd_dir(&candidate2) {
                                return Some(candidate2.to_string_lossy().to_string());
                            }
                            if let Some(grandparent) = parent.parent() {
                                let candidate3 = grandparent.join(rel_clean);
                                if candidate3.exists() && !is_placeholder_cd_dir(&candidate3) {
                                    return Some(candidate3.to_string_lossy().to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 1. Look for optical disc image files (.iso, .cue, .bin, .img, .nrg, .mds, .mdf)
    let mut image_candidates: Vec<PathBuf> = Vec::new();
    fn visit_for_images(dir: &Path, candidates: &mut Vec<PathBuf>, depth: usize) {
        if depth > 5 {
            return;
        }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with('.') || name == "__MACOSX" {
                    continue;
                }
                if path.is_dir() {
                    visit_for_images(&path, candidates, depth + 1);
                } else if path.is_file() {
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                        let ext_lower = ext.to_lowercase();
                        if matches!(ext_lower.as_str(), "iso" | "cue" | "ins" | "bin" | "img" | "nrg" | "mds" | "mdf") {
                            candidates.push(path);
                        }
                    }
                }
            }
        }
    }
    visit_for_images(game_dir, &mut image_candidates, 0);
    if let Some(ins) = image_candidates.iter().find(|p| p.extension().map(|e| e.to_string_lossy().eq_ignore_ascii_case("ins")).unwrap_or(false)) {
        return Some(ins.to_string_lossy().to_string());
    }
    if let Some(cue) = image_candidates.iter().find(|p| p.extension().map(|e| e.to_string_lossy().eq_ignore_ascii_case("cue")).unwrap_or(false)) {
        return Some(cue.to_string_lossy().to_string());
    }
    if let Some(iso) = image_candidates.iter().find(|p| p.extension().map(|e| e.to_string_lossy().eq_ignore_ascii_case("iso")).unwrap_or(false)) {
        return Some(iso.to_string_lossy().to_string());
    }
    if let Some(first) = image_candidates.first() {
        return Some(first.to_string_lossy().to_string());
    }

    // 2. Look for dedicated CD directory (e.g. app/CD, CD, CDROM, DISC, DISC1, CD1, app/CDROM)
    let cd_folder_names = [
        "app/CD", "app/CDROM", "app/DISC", "CD", "CDROM", "DISC", "DISC1", "CD1", "IMAGE",
        "IMAGES", "C/ALBIONCD", "ALBIONCD",
    ];
    for candidate in &cd_folder_names {
        let p = game_dir.join(candidate);
        if p.is_dir() && !is_placeholder_cd_dir(&p) {
            return Some(p.to_string_lossy().to_string());
        }
    }

    // 3. Search recursively for any folder named CD, CDROM, or ending with CD (e.g. ALBIONCD)
    let mut cd_dirs: Vec<PathBuf> = Vec::new();
    fn visit_for_cd_dirs(dir: &Path, candidates: &mut Vec<PathBuf>, depth: usize) {
        if depth > 4 {
            return;
        }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with('.') || name == "__MACOSX" {
                    continue;
                }
                if path.is_dir() {
                    let lower = name.to_ascii_lowercase();
                    if (lower == "cd"
                        || lower == "cdrom"
                        || lower == "disc"
                        || lower == "disc1"
                        || lower.ends_with("cd")
                        || lower.ends_with("cdrom")
                        || lower.contains("_cd"))
                        && !is_placeholder_cd_dir(&path)
                    {
                        candidates.push(path.clone());
                    }
                    visit_for_cd_dirs(&path, candidates, depth + 1);
                }
            }
        }
    }
    visit_for_cd_dirs(game_dir, &mut cd_dirs, 0);
    if let Some(first_cd) = cd_dirs.first() {
        return Some(first_cd.to_string_lossy().to_string());
    }

    // 4. If game has full install, mount the game directory itself as CD
    Some(game_dir.to_string_lossy().to_string())
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LibraryEntry {
    pub name: String,
    pub path: String,
    /// "game" (installed and runnable), "archive" (needs unpacking),
    /// "empty" (a folder with nothing runnable) or "file" (unrelated).
    pub kind: String,
    pub title: String,
    pub executable: String,
    pub working_dir: String,
    /// Total bytes on disk, walked for folders where metadata alone is the
    /// directory record rather than its contents.
    pub size_bytes: u64,
    /// Folder name to unpack an archive into, cleaned of installer noise.
    pub suggested_folder: String,
    pub detail: String,
}

/// Adds up the bytes actually stored under `path`.
fn directory_size(path: &Path, depth: usize) -> u64 {
    if depth > 12 {
        return 0;
    }
    let Ok(entries) = fs::read_dir(path) else {
        return 0;
    };
    entries
        .flatten()
        .map(|entry| match entry.file_type() {
            Ok(t) if t.is_dir() => directory_size(&entry.path(), depth + 1),
            Ok(t) if t.is_file() => entry.metadata().map(|m| m.len()).unwrap_or(0),
            _ => 0,
        })
        .sum()
}

/// Lists what actually sits in the library folder, classified, so the user can
/// decide what belongs in the library instead of the scan guessing for them.
/// Reports whether the external unpackers are present. Inno Setup packages
/// (GOG, OldGames.sk) need innoextract, which is not bundled, so the UI can say
/// so before a user tries and fails.
#[tauri::command]
fn missing_unpack_tools() -> Vec<String> {
    let mut missing = Vec::new();
    let has = |tool: &str| {
        [
            tool.to_string(),
            format!("/opt/homebrew/bin/{tool}"),
            format!("/usr/local/bin/{tool}"),
            format!("/usr/bin/{tool}"),
        ]
        .iter()
        .any(|bin| {
            Command::new(bin)
                .arg("--version")
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false)
        })
    };
    if !has("innoextract") {
        missing.push("innoextract".to_string());
    }
    if !has("7z") && !has("7zz") && !has("7za") {
        missing.push("sevenzip".to_string());
    }
    missing
}

#[tauri::command]
fn scan_library_entries(base_dir: String) -> Result<Vec<LibraryEntry>, String> {
    let root = expand_home_path(base_dir.trim());
    if !root.is_dir() {
        return Ok(Vec::new());
    }
    let entries = fs::read_dir(&root)
        .map_err(|e| format!("Failed to read '{}': {e}", root.display()))?
        .flatten()
        .collect::<Vec<_>>();

    let mut listed = Vec::new();
    for entry in entries {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name == "__MACOSX" {
            continue;
        }
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };

        let (kind, title, executable, working_dir, detail) = if file_type.is_dir() {
            match discover_executable(&path, None) {
                Some((working_dir, executable)) => (
                    "game",
                    name.replace(['_', '-'], " "),
                    executable.clone(),
                    working_dir,
                    format!("Installed game, starts {executable}"),
                ),
                None if bundled_scummvm_in(&path).is_some()
                    || bundled_scummvm_in(&path.join("game")).is_some() =>
                {
                    (
                        "scummvm",
                        name.replace(['_', '-'], " "),
                        String::new(),
                        String::new(),
                        "Installed ScummVM game".to_string(),
                    )
                }
                None => {
                    // Only an archive sitting at the top counts as "not unpacked".
                    // Recursing deeper would label an installed game an archive
                    // because of a zip buried inside a bundled engine.
                    let archives =
                        scan_game_archives(path.to_string_lossy().to_string())
                            .unwrap_or_default()
                            .into_iter()
                            .filter(|a| !a.relative_path.contains('/'))
                            .collect::<Vec<_>>();
                    match archives.first() {
                        Some(archive) => (
                            "archive",
                            clean_game_package_title(&name),
                            archive.file_name.clone(),
                            String::new(),
                            format!("Not unpacked yet ({})", archive.file_name),
                        ),
                        None => (
                            "empty",
                            name.replace(['_', '-'], " "),
                            String::new(),
                            String::new(),
                            "No runnable file found".to_string(),
                        ),
                    }
                }
            }
        } else {
            match detect_archive_format(&path) {
                Some(format) => (
                    "archive",
                    clean_game_package_title(&name),
                    name.clone(),
                    String::new(),
                    format!("Installer or archive ({format})"),
                ),
                None => (
                    "file",
                    name.clone(),
                    String::new(),
                    String::new(),
                    "Not a game or archive".to_string(),
                ),
            }
        };

        let suggested_folder = clean_game_package_folder_name(&name);
        listed.push(LibraryEntry {
            name,
            path: path.to_string_lossy().to_string(),
            kind: kind.to_string(),
            title: title.split_whitespace().collect::<Vec<_>>().join(" "),
            executable,
            working_dir,
            size_bytes: if file_type.is_dir() {
                directory_size(&path, 0)
            } else {
                entry.metadata().map(|m| m.len()).unwrap_or(0)
            },
            suggested_folder,
            detail,
        });
    }

    listed.sort_by(|a, b| {
        // Installed games first, then things that could become games.
        let rank = |k: &str| match k {
            "game" | "scummvm" => 0,
            "archive" => 1,
            "empty" => 2,
            _ => 3,
        };
        rank(&a.kind)
            .cmp(&rank(&b.kind))
            .then_with(|| a.title.to_lowercase().cmp(&b.title.to_lowercase()))
    });
    Ok(listed)
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
    let mut discovered_slugs = std::collections::HashSet::new();

    let entries = fs::read_dir(&root)
        .map_err(|e| format!("Failed to scan game library '{}': {e}", root.display()))?
        .flatten()
        .collect::<Vec<_>>();

    // 1. Process directories first
    for entry in &entries {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() || file_type.is_symlink() {
            continue;
        }
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let name_lower = name.to_ascii_lowercase();
        if name.starts_with('.')
            || matches!(
                name_lower.as_str(),
                "__macosx"
                    | "app"
                    | "tmp"
                    | "temp"
                    | "tools"
                    | "dosbox"
                    | "capture"
                    | "docs"
                    | "documentation"
                    | "saves"
            )
        {
            continue;
        }

        let slug = name.to_ascii_lowercase().replace(['_', '-', '.'], " ");
        let normalized_slug = slug.split_whitespace().collect::<Vec<_>>().join(" ");

        if let Some((working_dir, executable)) = discover_executable(&path, None) {
            let title = entry
                .file_name()
                .to_string_lossy()
                .replace(['_', '-'], " ")
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ");
            let cd_rom_path = discover_cd_media(&path);
            discovered_slugs.insert(normalized_slug);
            discovered_slugs.insert(title.to_ascii_lowercase());
            games.push(DiscoveredGame {
                title,
                target_folder: path.to_string_lossy().to_string(),
                working_dir,
                executable,
                cd_rom_path,
            });
        }
        // A folder holding only an archive is not an installed game. It shows up
        // in the library manager, where unpacking it is a deliberate choice.
    }

    // Standalone installers and archives in the library folder are left to the
    // library manager: the library lists what is installed, not what could be.

    games.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    Ok(games)
}

struct SpawnRequest {
    app: tauri::AppHandle,
    binary: String,
    args: Vec<String>,
    working_dir: Option<PathBuf>,
    game_id: Option<String>,
    emulator_type: String,
    success_message: String,
    failure_prefix: String,
    conf_content: Option<String>,
    /// Temporary file to delete once the emulator exits.
    cleanup_path: Option<PathBuf>,
}

/// Starts an emulator and records the play session, emitting `game-session-ended`
/// when it exits. Shared by every emulator backend so session bookkeeping and
/// temp-file cleanup stay in one place.
fn spawn_tracked_emulator(request: SpawnRequest) -> LaunchResult {
    let SpawnRequest {
        app,
        binary,
        args,
        working_dir,
        game_id,
        emulator_type,
        success_message,
        failure_prefix,
        conf_content,
        cleanup_path,
    } = request;

    let command_display = format!(
        "\"{}\" {}",
        binary,
        args.iter()
            .map(|a| format!("\"{a}\""))
            .collect::<Vec<_>>()
            .join(" ")
    );

    let mut command = Command::new(&binary);
    command.args(&args);
    if let Some(dir) = &working_dir {
        command.current_dir(dir);
    }

    match command.spawn() {
        Ok(mut child) => {
            let session = game_id.as_ref().and_then(|id| {
                database::database_start_play_session(app.clone(), id.clone(), emulator_type.clone())
                    .ok()
            });
            let tracked_session = game_id.zip(session);
            let app_handle = app.clone();
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
                if let Some(path) = cleanup_path {
                    let _ = fs::remove_file(path);
                }
            });
            LaunchResult {
                success: true,
                message: success_message,
                command_executed: Some(command_display),
                conf_generated: conf_content,
                session_id: session,
            }
        }
        Err(e) => LaunchResult {
            success: false,
            message: format!("{failure_prefix}: {e}"),
            command_executed: Some(command_display),
            conf_generated: conf_content,
            session_id: None,
        },
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScummvmGame {
    pub game_id: String,
    pub description: String,
    /// Folder the data actually lives in, which may be below the one searched.
    pub path: String,
}

/// Resolves which ScummVM to use: the configured one when present, otherwise a
/// copy bundled beside the game. GOG's Mac releases ship their own ScummVM, so
/// those games play without a separate install.
fn resolve_scummvm_binary(preferred: &str, game_dir: &Path) -> Option<PathBuf> {
    let configured = expand_home_path(preferred.trim());
    if !preferred.trim().is_empty() && configured.is_file() {
        return Some(configured);
    }
    // At launch the engine may sit beside the game, as GOG ships it.
    bundled_scummvm_in(game_dir)
        .or_else(|| game_dir.parent().and_then(bundled_scummvm_in))
}

/// Looks for a ScummVM bundled inside `root` only. Classification must not walk
/// up: the parent of a library entry is the library folder itself, and an engine
/// kept there would make every game in it look like a ScummVM release.
fn bundled_scummvm_in(root: &Path) -> Option<PathBuf> {
    let nested = root
        .join("scummvm")
        .join("Contents")
        .join("MacOS")
        .join("scummvm");
    for candidate in [nested, root.join("scummvm")] {
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

/// Asks ScummVM to identify the game in `game_dir`. ScummVM prints a table of
/// `ID  Description  Full Path`; the id is the launch target.
#[tauri::command]
fn detect_scummvm_game(
    binary_path: String,
    game_dir: String,
) -> Result<Option<ScummvmGame>, String> {
    let dir = expand_home_path(game_dir.trim());
    if !dir.is_dir() {
        return Err(format!("Game folder '{}' was not found.", dir.display()));
    }
    let binary = resolve_scummvm_binary(&binary_path, &dir).ok_or_else(|| {
        "ScummVM was not found. Install it or set its path in Configuration.".to_string()
    })?;

    // Try the folder itself first: it is fast and unambiguous. Only if nothing
    // is there do we recurse, so picking a game's own folder never pays for a
    // full-tree scan.
    let direct = run_scummvm_detect(&binary, &dir, false)?;
    if !direct.is_empty() {
        return Ok(single_game(direct));
    }

    // A GOG release unpacks to a wrapper holding the data one level down, so
    // recurse to find it. If several games turn up the folder is a library
    // rather than one game, and guessing which to attach would be wrong.
    let nested = run_scummvm_detect(&binary, &dir, true)?;
    Ok(single_game(nested))
}

/// Collapses a detection result to one game.
///
/// ScummVM can list several rows for the same title in the same folder (release
/// or language variants); those describe one installation. Rows differing in
/// either the game or the folder mean there is a real choice to make — several
/// games, or the same game installed more than once — and picking one would be
/// guessing, so nothing is attached.
fn single_game(rows: Vec<ScummvmGame>) -> Option<ScummvmGame> {
    let mut identities: Vec<(&str, &str)> = rows
        .iter()
        .map(|row| (row.game_id.as_str(), row.path.as_str()))
        .collect();
    identities.sort_unstable();
    identities.dedup();
    if identities.len() == 1 {
        rows.into_iter().next()
    } else {
        None
    }
}

/// Runs ScummVM's detector and parses its `ID  Description  Full Path` table.
fn run_scummvm_detect(
    binary: &Path,
    dir: &Path,
    recursive: bool,
) -> Result<Vec<ScummvmGame>, String> {
    // --path must precede --detect; ScummVM ignores it otherwise.
    let mut command = Command::new(binary);
    command.arg(format!("--path={}", dir.to_string_lossy()));
    if recursive {
        command.arg("--recursive");
    }
    let output = command
        .arg("--detect")
        .output()
        .map_err(|e| format!("Failed to run ScummVM: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut found = Vec::new();
    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty()
            || trimmed.starts_with("ID ")
            || trimmed.starts_with("--")
            || trimmed.starts_with("WARNING")
        {
            continue;
        }
        // Columns are separated by runs of spaces; the last one is the path.
        let mut columns = trimmed.split("  ").filter(|c| !c.trim().is_empty());
        let Some(id) = columns.next().map(|c| c.trim().to_string()) else {
            continue;
        };
        if id.is_empty() {
            continue;
        }
        let description = columns
            .next()
            .map(|c| c.trim().to_string())
            .unwrap_or_else(|| id.clone());
        let path = columns
            .next()
            .map(|c| c.trim().to_string())
            .filter(|p| !p.is_empty())
            .unwrap_or_else(|| dir.to_string_lossy().to_string());
        found.push(ScummvmGame {
            game_id: id,
            description,
            path,
        });
    }
    Ok(found)
}

#[tauri::command]
fn launch_scummvm_command(
    app: tauri::AppHandle,
    binary_path: String,
    game_dir: String,
    scummvm_game_id: String,
    game_title: String,
    game_id: Option<String>,
    fullscreen: Option<bool>,
) -> Result<LaunchResult, String> {
    let dir = expand_home_path(game_dir.trim());
    if !dir.is_dir() {
        return Err(format!("Game folder '{}' was not found.", dir.display()));
    }
    let binary = resolve_scummvm_binary(&binary_path, &dir).ok_or_else(|| {
        "ScummVM was not found. Install it or set its path in Configuration.".to_string()
    })?;
    let target = scummvm_game_id.trim();
    if target.is_empty() || !is_valid_identifier(target) {
        return Err("The ScummVM game id is missing or invalid.".to_string());
    }

    let mut args = vec![format!("--path={}", dir.to_string_lossy())];
    if fullscreen.unwrap_or(false) {
        args.push("--fullscreen".to_string());
    }
    args.push(target.to_string());

    Ok(spawn_tracked_emulator(SpawnRequest {
        app,
        binary: binary.to_string_lossy().to_string(),
        args,
        working_dir: Some(dir),
        game_id,
        emulator_type: "scummvm".to_string(),
        success_message: format!("Successfully started ScummVM for '{game_title}'!"),
        failure_prefix: "Failed to spawn ScummVM process".to_string(),
        conf_content: None,
        cleanup_path: None,
    }))
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

    let success_message = if used_fallback {
        format!(
            "Started '{}' with the automatically detected DOSBox at '{}'.",
            game_title, resolved_binary
        )
    } else {
        format!("Successfully started DOSBox for '{}'!", game_title)
    };

    Ok(spawn_tracked_emulator(
        SpawnRequest {
            app,
            binary: resolved_binary,
            args: vec!["-conf".to_string(), conf_path_str],
            working_dir: None,
            game_id,
            emulator_type: emulator_type.unwrap_or_else(|| "dosbox".to_string()),
            success_message,
            failure_prefix: "Failed to spawn DOSBox process".to_string(),
            conf_content: Some(conf_content),
            cleanup_path: Some(conf_path),
        },
    ))
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
        (
            "ScummVM (App)",
            "/Applications/ScummVM.app/Contents/MacOS/scummvm".to_string(),
            "scummvm",
        ),
        (
            "ScummVM (User Apps)",
            home.join("Applications/ScummVM.app/Contents/MacOS/scummvm")
                .to_string_lossy()
                .to_string(),
            "scummvm",
        ),
        (
            "ScummVM (Homebrew)",
            "/opt/homebrew/bin/scummvm".to_string(),
            "scummvm",
        ),
        (
            "ScummVM (/usr/local/bin)",
            "/usr/local/bin/scummvm".to_string(),
            "scummvm",
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
            import_artwork_file,
            scan_library_entries,
            missing_unpack_tools,
            detect_scummvm_game,
            launch_scummvm_command,
            open_catalog_source,
            download_and_install_archive_game,
            prepare_game_launch,
            scan_installed_games,
            launch_dosbox_command,
            detect_dosbox_installations,
            toggle_app_fullscreen,
            scan_game_archives,
            unpack_game_archive,
            ensure_dos_tools
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

    #[test]
    fn archive_scanning_and_unpacking_works() {
        let temp = tempfile::tempdir().expect("temp dir");
        let zip_file = temp.path().join("game_archive.zip");
        let dest = temp.path().join("EXTRACTED");

        // Create a test zip archive with a nested folder
        {
            let file = File::create(&zip_file).expect("create test zip");
            let mut zip = ZipWriter::new(file);
            let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
            zip.start_file("MYGAME/PLAY.EXE", options).expect("zip file entry");
            zip.write_all(b"dummy game executable").expect("write zip content");
            zip.start_file("MYGAME/SETUP.EXE", options).expect("zip setup entry");
            zip.write_all(b"dummy setup executable").expect("write zip content");
            zip.finish().expect("finish zip");
        }

        // Test scanning
        let archives = scan_game_archives(temp.path().to_string_lossy().to_string()).expect("scan");
        assert_eq!(archives.len(), 1);
        assert_eq!(archives[0].file_name, "game_archive.zip");
        assert_eq!(archives[0].format, "zip");

        // Test unpacking with unnesting
        let unpack = unpack_game_archive(
            zip_file.to_string_lossy().to_string(),
            dest.to_string_lossy().to_string(),
            true,
            false,
        )
        .expect("unpack archive");

        assert!(unpack.success);
        assert_eq!(unpack.discovered_executable, Some("PLAY.EXE".to_string()));
        assert!(dest.join("PLAY.EXE").is_file());
        assert!(dest.join("SETUP.EXE").is_file());
        assert!(!unpack.installer_candidates.is_empty());
    }

    #[test]
    fn gog_layout_is_read_from_bundled_metadata() {
        let temp = std::env::temp_dir().join("gamesky_gog_layout_test");
        let _ = fs::remove_dir_all(&temp);
        fs::create_dir_all(temp.join("__support").join("app")).unwrap();

        fs::write(
            temp.join("goggame-1436955815.info"),
            r#"{"name":"Albion","gameId":"1436955815"}"#,
        )
        .unwrap();
        fs::write(temp.join("game.ins"), "FILE \"game.gog\" BINARY\n").unwrap();
        fs::write(temp.join("ALBION.EXE"), "MZ").unwrap();
        fs::write(temp.join("SETUP.EXE"), "MZ").unwrap();
        fs::write(
            temp.join("__support").join("app").join("dosbox_x_single.conf"),
            "[autoexec]\nmount c \"..\"\nimgmount d \"..\\game.ins\" -t iso -fs iso\nc:\n:game\nALBION.EXE\n:setup\nsetup.exe\n",
        )
        .unwrap();

        let layout = detect_gog_layout(&temp).expect("GOG layout should be detected");
        assert_eq!(layout.title.as_deref(), Some("Albion"));
        assert_eq!(layout.executable.as_deref(), Some("ALBION.EXE"));
        assert!(layout.cd_rom_path.as_deref().unwrap().ends_with("game.ins"));

        // A plain DOS folder must not be mistaken for a GOG release.
        let plain = std::env::temp_dir().join("gamesky_plain_layout_test");
        let _ = fs::remove_dir_all(&plain);
        fs::create_dir_all(&plain).unwrap();
        fs::write(plain.join("ALBION.EXE"), "MZ").unwrap();
        assert!(detect_gog_layout(&plain).is_none());

        let _ = fs::remove_dir_all(&temp);
        let _ = fs::remove_dir_all(&plain);
    }

    #[test]
    fn artwork_import_accepts_only_real_images() {
        let png = [0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0];
        assert_eq!(image_extension_from_bytes(&png), Some("png"));
        assert_eq!(image_extension_from_bytes(&[0xff, 0xd8, 0xff, 0xe0]), Some("jpg"));
        assert_eq!(image_extension_from_bytes(b"GIF89a...."), Some("gif"));

        let mut webp = Vec::from(*b"RIFF");
        webp.extend_from_slice(&[0, 0, 0, 0]);
        webp.extend_from_slice(b"WEBP");
        assert_eq!(image_extension_from_bytes(&webp), Some("webp"));

        // An executable renamed to .png must not reach the artwork cache.
        assert_eq!(image_extension_from_bytes(b"MZ\x90\x00"), None);
        assert_eq!(image_extension_from_bytes(b""), None);
        assert_eq!(image_extension_from_bytes(b"RIFF____AVI "), None);
    }

    #[test]
    fn artwork_import_replaces_previous_cover() {
        let dir = std::env::temp_dir().join("gamesky_artwork_import_test");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        let png_path = dir.join("source.png");
        let mut png = vec![0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a];
        png.extend_from_slice(&[0u8; 32]);
        fs::write(&png_path, &png).unwrap();

        let first = import_artwork_into(&dir, "game-local-abc", png_path.to_str().unwrap(), 1000)
            .expect("import should succeed");
        assert!(PathBuf::from(&first).is_file());
        assert!(first.ends_with("game-local-abc-custom-1000.png"));

        // Re-importing must leave exactly one cover, under a fresh name.
        let second = import_artwork_into(&dir, "game-local-abc", png_path.to_str().unwrap(), 2000)
            .expect("second import should succeed");
        assert!(second.ends_with("game-local-abc-custom-2000.png"));
        assert!(!PathBuf::from(&first).exists(), "old cover should be removed");
        let covers = fs::read_dir(&dir)
            .unwrap()
            .flatten()
            .filter(|e| e.file_name().to_string_lossy().starts_with("game-local-abc-custom-"))
            .count();
        assert_eq!(covers, 1);

        // A non-image and a traversal-style id must both be refused.
        let fake = dir.join("fake.png");
        fs::write(&fake, b"MZ\x90 not an image").unwrap();
        assert!(import_artwork_into(&dir, "game-local-abc", fake.to_str().unwrap(), 3000).is_err());
        assert!(import_artwork_into(&dir, "../escape", png_path.to_str().unwrap(), 4000).is_err());
        assert!(import_artwork_into(&dir, "game-local-abc", "/nope/missing.png", 5000).is_err());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn xar_container_is_detected_as_pkg() {
        let dir = std::env::temp_dir().join("gamesky_xar_detect_test");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();

        let pkg = dir.join("installer.pkg");
        let mut header = Vec::from(*b"xar!");
        header.extend_from_slice(&[0u8; 24]);
        fs::write(&pkg, &header).unwrap();
        assert_eq!(detect_archive_format(&pkg).as_deref(), Some("pkg"));

        // Extension alone is enough when the bytes are unreadable as anything else.
        let by_ext = dir.join("other.pkg");
        fs::write(&by_ext, b"not a xar container at all").unwrap();
        assert_eq!(detect_archive_format(&by_ext).as_deref(), Some("pkg"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    #[ignore = "set GAMESKY_TEST_PKG to a GOG macOS .pkg"]
    fn macos_pkg_payload_is_unpacked() {
        let Ok(pkg) = std::env::var("GAMESKY_TEST_PKG") else {
            return;
        };
        let pkg = PathBuf::from(pkg);
        if !pkg.is_file() {
            return;
        }
        assert_eq!(detect_archive_format(&pkg).as_deref(), Some("pkg"));

        let dest = std::env::temp_dir().join("gamesky_pkg_unpack_test");
        let _ = fs::remove_dir_all(&dest);
        fs::create_dir_all(&dest).unwrap();

        extract_macos_pkg(&pkg, &dest).expect("pkg payload should unpack");
        // The wrapped app's Resources/game folder is hoisted to the root.
        assert!(dest.join("game").is_dir(), "game data should be present");
        assert!(dest.join("scummvm").exists(), "bundled engine should be present");
        assert!(!dest.join(".pkg-staging").exists(), "staging should be cleaned up");

        let mut exes = Vec::new();
        collect_executable_files(&dest, 0, &mut exes);
        assert!(exes.is_empty(), "a ScummVM release has no DOS executable");

        let _ = fs::remove_dir_all(&dest);
    }

    #[test]
    #[ignore = "set GAMESKY_TEST_PKG to a GOG macOS .pkg"]
    fn scummvm_release_reports_that_dosbox_cannot_run_it() {
        let Ok(pkg) = std::env::var("GAMESKY_TEST_PKG") else {
            return;
        };
        if !PathBuf::from(&pkg).is_file() {
            return;
        }
        let dest = std::env::temp_dir().join("gamesky_pkg_message_test");
        let _ = fs::remove_dir_all(&dest);

        let result = unpack_game_archive(pkg, dest.to_string_lossy().to_string(), false, false)
            .expect("unpack should succeed");

        assert!(result.success);
        assert!(result.discovered_executable.is_none());
        assert!(
            result.message.contains("ScummVM"),
            "message should explain why it will not run: {}",
            result.message
        );

        let _ = fs::remove_dir_all(&dest);
    }

    #[test]
    #[ignore = "set GAMESKY_TEST_SCUMMVM and GAMESKY_TEST_SCUMMVM_DIR"]
    fn scummvm_game_is_detected_from_its_data_files() {
        let (Ok(bin), Ok(dir)) = (
            std::env::var("GAMESKY_TEST_SCUMMVM"),
            std::env::var("GAMESKY_TEST_SCUMMVM_DIR"),
        ) else {
            return;
        };
        let found = detect_scummvm_game(bin.clone(), dir)
            .expect("detection should run")
            .expect("a game should be found");
        assert_eq!(found.game_id, "sky");
        assert!(
            found.description.contains("Beneath a Steel Sky"),
            "unexpected description: {}",
            found.description
        );

        // A folder with no ScummVM game yields None rather than an error.
        let empty = std::env::temp_dir().join("gamesky_scummvm_empty");
        let _ = fs::remove_dir_all(&empty);
        fs::create_dir_all(&empty).unwrap();
        let none = detect_scummvm_game(bin, empty.to_string_lossy().to_string())
            .expect("detection should run on an empty folder");
        assert!(none.is_none());
        let _ = fs::remove_dir_all(&empty);
    }

    #[test]
    fn bundled_scummvm_is_preferred_when_none_is_installed() {
        let root = std::env::temp_dir().join("gamesky_scummvm_resolve_test");
        let _ = fs::remove_dir_all(&root);
        let bundled = root.join("scummvm").join("Contents").join("MacOS");
        fs::create_dir_all(&bundled).unwrap();
        fs::write(bundled.join("scummvm"), b"binary").unwrap();
        let game_dir = root.join("game");
        fs::create_dir_all(&game_dir).unwrap();

        // GOG layout: the game sits beside the bundled engine.
        let found = resolve_scummvm_binary("/nonexistent/scummvm", &game_dir)
            .expect("bundled ScummVM should be found next to the game");
        assert!(found.ends_with("scummvm/Contents/MacOS/scummvm"));

        // A configured, existing binary still wins.
        let installed = root.join("installed-scummvm");
        fs::write(&installed, b"binary").unwrap();
        let chosen = resolve_scummvm_binary(&installed.to_string_lossy(), &game_dir).unwrap();
        assert_eq!(chosen, installed);

        // Nothing anywhere yields None rather than a bogus path.
        let bare = std::env::temp_dir().join("gamesky_scummvm_resolve_bare");
        let _ = fs::remove_dir_all(&bare);
        fs::create_dir_all(&bare).unwrap();
        assert!(resolve_scummvm_binary("", &bare).is_none());

        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&bare);
    }

    #[test]
    #[ignore = "set GAMESKY_TEST_PKG to a GOG macOS .pkg"]
    fn gog_scummvm_package_configures_itself_end_to_end() {
        let Ok(pkg) = std::env::var("GAMESKY_TEST_PKG") else {
            return;
        };
        if !PathBuf::from(&pkg).is_file() {
            return;
        }
        let dest = std::env::temp_dir().join("gamesky_scummvm_e2e");
        let _ = fs::remove_dir_all(&dest);

        // 1. The package unpacks and reports that DOSBox cannot run it.
        let unpack =
            unpack_game_archive(pkg, dest.to_string_lossy().to_string(), false, false).unwrap();
        assert!(unpack.success);
        assert!(unpack.discovered_executable.is_none());
        assert!(unpack.message.contains("ScummVM"));

        // 2. With no ScummVM installed, the bundled one is still found...
        let game_dir = dest.join("game");
        assert!(game_dir.is_dir());
        let binary = resolve_scummvm_binary("", &game_dir)
            .expect("the package ships its own ScummVM");

        // 3. ...and it identifies the game, giving us a launch target.
        let detected = detect_scummvm_game(
            binary.to_string_lossy().to_string(),
            game_dir.to_string_lossy().to_string(),
        )
        .unwrap()
        .expect("ScummVM should recognise the game");
        assert_eq!(detected.game_id, "sky");

        let _ = fs::remove_dir_all(&dest);
    }

    #[test]
    #[ignore = "set GAMESKY_TEST_SCUMMVM_INSTALL to an unpacked GOG ScummVM game"]
    fn importing_a_scummvm_folder_finds_engine_and_game() {
        let Ok(root) = std::env::var("GAMESKY_TEST_SCUMMVM_INSTALL") else {
            return;
        };
        let root = PathBuf::from(root);
        if !root.is_dir() {
            return;
        }
        // The user picks the folder holding the data files; the engine sits
        // beside it, which is the layout GOG ships.
        let game_dir = root.join("game");
        let binary = resolve_scummvm_binary("", &game_dir)
            .expect("bundled engine should be found from the game folder");
        let detected = detect_scummvm_game(
            binary.to_string_lossy().to_string(),
            game_dir.to_string_lossy().to_string(),
        )
        .unwrap()
        .expect("ScummVM should recognise the game");
        assert_eq!(detected.game_id, "sky");

        assert_eq!(PathBuf::from(&detected.path), game_dir);

        // Picking the folder the user actually downloaded must work too: the
        // data sits one level down, and detection reports where it found it.
        let from_wrapper = detect_scummvm_game(
            binary.to_string_lossy().to_string(),
            root.to_string_lossy().to_string(),
        )
        .unwrap()
        .expect("recursive detection should find the game below the wrapper");
        assert_eq!(from_wrapper.game_id, "sky");
        assert_eq!(
            PathBuf::from(&from_wrapper.path),
            game_dir,
            "the reported path should point at the data, not the folder searched"
        );
    }

    #[test]
    fn gog_support_data_is_merged_not_deleted() {
        let root = std::env::temp_dir().join("gamesky_gog_prune_test");
        let _ = fs::remove_dir_all(&root);
        // Root ships XLDLIBS/INITIAL; app/ carries the live state GOG installs.
        fs::create_dir_all(root.join("XLDLIBS").join("INITIAL")).unwrap();
        fs::write(root.join("XLDLIBS").join("INITIAL").join("A.XLD"), b"x").unwrap();
        fs::create_dir_all(root.join("app").join("XLDLIBS").join("CURRENT")).unwrap();
        fs::write(
            root.join("app").join("XLDLIBS").join("CURRENT").join("B.XLD"),
            b"y",
        )
        .unwrap();
        fs::create_dir_all(root.join("app").join("SAVES")).unwrap();
        for junk in ["tmp", "__redist", "commonappdata"] {
            fs::create_dir_all(root.join(junk)).unwrap();
        }

        prune_gog_installer_scaffolding(&root);

        // Support data survives, merged alongside what the root already had.
        assert!(root.join("XLDLIBS").join("CURRENT").join("B.XLD").is_file());
        assert!(root.join("XLDLIBS").join("INITIAL").join("A.XLD").is_file());
        assert!(root.join("SAVES").is_dir());
        assert!(!root.join("app").exists());
        for junk in ["tmp", "__redist", "commonappdata"] {
            assert!(!root.join(junk).exists(), "{junk} should be pruned");
        }

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn merge_replaces_files_and_keeps_both_sides() {
        let base = std::env::temp_dir().join("gamesky_merge_test");
        let _ = fs::remove_dir_all(&base);
        let src = base.join("src");
        let dst = base.join("dst");
        fs::create_dir_all(src.join("shared")).unwrap();
        fs::create_dir_all(dst.join("shared")).unwrap();
        fs::write(src.join("shared").join("new.txt"), b"new").unwrap();
        fs::write(src.join("shared").join("clash.txt"), b"fresh").unwrap();
        fs::write(dst.join("shared").join("old.txt"), b"old").unwrap();
        fs::write(dst.join("shared").join("clash.txt"), b"stale").unwrap();

        merge_directory_into(&src, &dst).unwrap();

        assert_eq!(fs::read(dst.join("shared").join("old.txt")).unwrap(), b"old");
        assert_eq!(fs::read(dst.join("shared").join("new.txt")).unwrap(), b"new");
        // An existing file is replaced rather than silently skipped.
        assert_eq!(
            fs::read(dst.join("shared").join("clash.txt")).unwrap(),
            b"fresh"
        );

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn cd_config_rewrite_is_guarded_and_reversible() {
        let dir = std::env::temp_dir().join("gamesky_harmonize_test");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let ini = dir.join("SETUP.INI");
        let original = "[SYSTEM]\r\nSOURCE_PATH = C:\\ALBIONCD\\\r\nCDROM_SPEED=4\r\n";
        fs::write(&ini, original).unwrap();

        // With no CD mounted the user's file must be left exactly as it was.
        harmonize_game_cd_config(&dir, false);
        assert_eq!(fs::read_to_string(&ini).unwrap(), original);
        assert!(!dir.join("SETUP.INI.gamesky-backup").exists());

        harmonize_game_cd_config(&dir, true);
        let rewritten = fs::read_to_string(&ini).unwrap();
        assert!(rewritten.contains("SOURCE_PATH = D:\\"));
        // A key that merely starts with CDROM is not a CD path.
        assert!(
            rewritten.contains("CDROM_SPEED=4"),
            "unrelated key was corrupted: {rewritten}"
        );
        // The shipped value stays recoverable.
        let backup = fs::read_to_string(dir.join("SETUP.INI.gamesky-backup")).unwrap();
        assert!(backup.contains("C:\\ALBIONCD"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    #[ignore = "set GAMESKY_TEST_SCUMMVM and GAMESKY_TEST_AMBIGUOUS_DIR"]
    fn ambiguous_folder_attaches_no_game() {
        let (Ok(bin), Ok(dir)) = (
            std::env::var("GAMESKY_TEST_SCUMMVM"),
            std::env::var("GAMESKY_TEST_AMBIGUOUS_DIR"),
        ) else {
            return;
        };
        if !PathBuf::from(&dir).is_dir() {
            return;
        }
        // Two games below the folder: picking either one would be a guess.
        let rows = run_scummvm_detect(&PathBuf::from(&bin), &PathBuf::from(&dir), true).unwrap();
        assert!(rows.len() > 1, "fixture should hold more than one game");
        assert!(
            detect_scummvm_game(bin, dir).unwrap().is_none(),
            "an ambiguous folder must not silently attach one of the games"
        );
    }

    #[test]
    fn merge_preserves_symlinked_bundle_layout() {
        use std::os::unix::fs::symlink;

        let base = std::env::temp_dir().join("gamesky_merge_symlink_test");
        let _ = fs::remove_dir_all(&base);
        let src = base.join("src");
        let dst = base.join("dst");

        // The shape a macOS framework uses: real files under Versions/A,
        // exposed at the top level through directory symlinks.
        let real = src.join("F.framework").join("Versions").join("A").join("Resources");
        fs::create_dir_all(&real).unwrap();
        fs::write(real.join("a.txt"), b"a").unwrap();
        fs::write(real.join("b.txt"), b"b").unwrap();
        symlink(
            "Versions/A/Resources",
            src.join("F.framework").join("Resources"),
        )
        .unwrap();

        merge_directory_into(&src, &dst).unwrap();

        let moved = dst.join("F.framework");
        let link = moved.join("Resources");
        assert!(
            fs::symlink_metadata(&link).unwrap().file_type().is_symlink(),
            "the directory symlink must survive as a symlink"
        );
        // Following the link must still reach the real files: the target keeps
        // its contents instead of being emptied into the link's place.
        let target = moved.join("Versions").join("A").join("Resources");
        assert!(target.join("a.txt").is_file());
        assert!(target.join("b.txt").is_file());
        assert_eq!(fs::read_dir(&target).unwrap().count(), 2);
        assert_eq!(fs::read(link.join("a.txt")).unwrap(), b"a");

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn cd_rewrite_guard_ignores_the_discovery_fallback() {
        let root = PathBuf::from("/games/Albion");
        // discover_cd_media falls back to the game directory itself when it
        // finds no media; that must not count as a mounted CD.
        assert!(!is_real_cd_media("/games/Albion", &root));
        assert!(!is_real_cd_media("", &root));
        assert!(!is_real_cd_media("   ", &root));
        // Real media, whether an image or a separate folder, does count.
        assert!(is_real_cd_media("/games/Albion/CD/disc.iso", &root));
        assert!(is_real_cd_media("/games/Albion/C/ALBIONCD", &root));
    }

    #[test]
    fn variants_of_one_game_are_not_treated_as_ambiguous() {
        let row = |id: &str, path: &str| ScummvmGame {
            game_id: id.to_string(),
            description: format!("{id} at {path}"),
            path: path.to_string(),
        };

        assert!(single_game(Vec::new()).is_none());
        assert_eq!(single_game(vec![row("sky", "/a")]).unwrap().game_id, "sky");

        // Same title, same folder (language or release variants) is one game.
        let variants = single_game(vec![row("sky", "/a"), row("sky", "/a")]);
        assert_eq!(variants.unwrap().game_id, "sky");

        // Different titles mean a library folder; picking one would be a guess.
        assert!(single_game(vec![row("sky", "/a"), row("monkey", "/b")]).is_none());

        // The same game installed twice is also a choice we must not make for
        // the user: the folders differ, and row order is not deterministic.
        assert!(single_game(vec![row("sky", "/a"), row("sky", "/b")]).is_none());
    }

    #[test]
    #[ignore = "set GAMESKY_TEST_PKG to a GOG macOS .pkg"]
    fn real_package_keeps_its_framework_bundle_intact() {
        let Ok(pkg) = std::env::var("GAMESKY_TEST_PKG") else {
            return;
        };
        if !PathBuf::from(&pkg).is_file() {
            return;
        }
        let dest = std::env::temp_dir().join("gamesky_bundle_integrity");
        let _ = fs::remove_dir_all(&dest);
        unpack_game_archive(pkg, dest.to_string_lossy().to_string(), false, false).unwrap();

        let framework = dest
            .join("scummvm/Contents/Frameworks/Sparkle.framework");
        if !framework.is_dir() {
            return;
        }
        // The top-level entries are symlinks into Versions/A in a well-formed
        // framework; a previous merge turned them into real directories and
        // emptied the target.
        for name in ["Resources", "PrivateHeaders", "Headers"] {
            let entry = framework.join(name);
            if !entry.exists() {
                continue;
            }
            assert!(
                fs::symlink_metadata(&entry).unwrap().file_type().is_symlink(),
                "{name} should still be a symlink, not a real directory"
            );
        }
        let resources = framework.join("Versions").join("A").join("Resources");
        assert!(
            fs::read_dir(&resources).unwrap().count() > 10,
            "the symlink target keeps its contents"
        );

        let _ = fs::remove_dir_all(&dest);
    }

    #[test]
    fn support_binaries_never_outrank_the_real_launcher() {
        let dir = std::env::temp_dir().join("gamesky_support_rank_test");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        // Alphabetically DOS4GW sorts first and shares the base score, so name
        // order alone used to hand it the top spot.
        for name in ["DOS4GW.EXE", "LAUNCH.EXE", "MAIN.EXE"] {
            fs::write(dir.join(name), b"MZ").unwrap();
        }

        let mut ranked: Vec<_> = ["DOS4GW.EXE", "LAUNCH.EXE", "MAIN.EXE"]
            .iter()
            .map(|n| score_executable(&dir, &dir.join(n)))
            .collect();
        ranked.sort_by(|a, b| {
            b.score
                .cmp(&a.score)
                .then_with(|| a.absolute_path.cmp(&b.absolute_path))
        });

        assert_ne!(
            ranked[0].executable, "DOS4GW.EXE",
            "the DOS extender must not be the top game candidate"
        );
        let extender = ranked
            .iter()
            .find(|c| c.executable == "DOS4GW.EXE")
            .unwrap();
        assert_ne!(extender.role, "game");
        assert!(extender.score < ranked[0].score);
    }

    #[test]
    fn documentation_programs_lose_to_the_game() {
        let dir = std::env::temp_dir().join("gamesky_aux_rank_test");
        let _ = fs::remove_dir_all(&dir);
        // Wolfenstein ships HELP.EXE inside a HELP folder, so the "file matches
        // its folder" bonus used to hand it the top spot over the game itself.
        let help_dir = dir.join("WOLF3D").join("HELP");
        fs::create_dir_all(&help_dir).unwrap();
        fs::write(help_dir.join("HELP.EXE"), b"MZ").unwrap();
        fs::write(dir.join("WOLF3D").join("WOLF3D.EXE"), b"MZ").unwrap();

        let (_, executable) =
            discover_executable(&dir, None).expect("a game executable should be found");
        assert_eq!(executable, "WOLF3D.EXE");

        let help = score_executable(&dir, &help_dir.join("HELP.EXE"));
        assert_eq!(help.role, "documentation");
        let game = score_executable(&dir, &dir.join("WOLF3D").join("WOLF3D.EXE"));
        assert!(game.score > help.score);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn only_installed_games_are_auto_added() {
        let root = std::env::temp_dir().join("gamesky_scan_scope_test");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();

        // An installed game.
        fs::create_dir_all(root.join("RealGame")).unwrap();
        fs::write(root.join("RealGame").join("PLAY.BAT"), b"@echo off").unwrap();
        // A loose installer, and a folder holding only an archive: neither is
        // installed, so neither belongs in the library.
        let mut zip = Vec::from(*b"PK\x03\x04");
        zip.extend_from_slice(&[0u8; 64]);
        fs::write(root.join("setup_something.zip"), &zip).unwrap();
        fs::create_dir_all(root.join("NotUnpacked")).unwrap();
        fs::write(root.join("NotUnpacked").join("game.zip"), &zip).unwrap();

        let auto = scan_installed_games(root.to_string_lossy().to_string()).unwrap();
        let titles: Vec<&str> = auto.iter().map(|g| g.title.as_str()).collect();
        assert_eq!(titles, vec!["RealGame"], "only the installed game is added");

        // The manager still shows everything, classified.
        let listed = scan_library_entries(root.to_string_lossy().to_string()).unwrap();
        let kind_of = |title: &str| {
            listed
                .iter()
                .find(|e| e.title.contains(title))
                .map(|e| e.kind.clone())
                .unwrap_or_default()
        };
        assert_eq!(kind_of("RealGame"), "game");
        assert_eq!(kind_of("setup something"), "archive");
        assert_eq!(kind_of("NotUnpacked"), "archive");

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn engine_lookup_does_not_leak_into_sibling_folders() {
        let root = std::env::temp_dir().join("gamesky_engine_scope_test");
        let _ = fs::remove_dir_all(&root);
        // A ScummVM kept in the library folder itself, next to unrelated games.
        fs::create_dir_all(root.join("scummvm").join("Contents").join("MacOS")).unwrap();
        fs::write(
            root.join("scummvm").join("Contents").join("MacOS").join("scummvm"),
            b"binary",
        )
        .unwrap();
        let dos_game = root.join("Dune2");
        fs::create_dir_all(&dos_game).unwrap();
        fs::write(dos_game.join("DUNE2.EXE"), b"MZ").unwrap();

        // Classification looks only inside the folder, so the DOS game is not
        // mistaken for a ScummVM release because of its neighbour.
        assert!(bundled_scummvm_in(&dos_game).is_none());
        assert!(bundled_scummvm_in(&root).is_some());

        // Launching still finds an engine sitting beside the game, as GOG ships it.
        assert!(resolve_scummvm_binary("", &dos_game).is_some());

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn library_entries_report_real_sizes_and_clean_folder_names() {
        let root = std::env::temp_dir().join("gamesky_entry_meta_test");
        let _ = fs::remove_dir_all(&root);
        let game = root.join("BigGame");
        fs::create_dir_all(game.join("DATA")).unwrap();
        fs::write(game.join("PLAY.BAT"), b"@echo off").unwrap();
        fs::write(game.join("DATA").join("blob.bin"), vec![0u8; 5000]).unwrap();

        let listed = scan_library_entries(root.to_string_lossy().to_string()).unwrap();
        let entry = listed.iter().find(|e| e.name == "BigGame").unwrap();
        // Directory metadata alone would report the directory record, not 5 KB.
        assert!(
            entry.size_bytes >= 5000,
            "folder size should count its contents, got {}",
            entry.size_bytes
        );
        assert!(!entry.suggested_folder.is_empty());

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn missing_tools_reflects_what_is_installed() {
        let missing = missing_unpack_tools();
        // innoextract is present on this machine, so it must not be reported.
        let innoextract_present = ["/opt/homebrew/bin/innoextract", "/usr/local/bin/innoextract"]
            .iter()
            .any(|p| PathBuf::from(p).is_file());
        assert_eq!(
            missing.contains(&"innoextract".to_string()),
            !innoextract_present,
            "reported {missing:?} while innoextract present = {innoextract_present}"
        );
    }

    #[test]
    fn gog_mac_release_of_a_dos_game_unpacks_without_extra_tools() {
        // GOG's Mac builds wrap DOSBox rather than ScummVM. The real ScummVM
        // package is covered elsewhere; this builds the DOSBox shape so the
        // path is exercised without needing that download.
        if !PathBuf::from("/usr/bin/xar").is_file() {
            return;
        }
        let base = std::env::temp_dir().join("gamesky_mac_dospkg_test");
        let _ = fs::remove_dir_all(&base);
        let build = base.join("build");
        let game = build.join("payload/Contents/Resources/game");
        fs::create_dir_all(game.join("DUNE2")).unwrap();
        fs::create_dir_all(game.join("dosbox")).unwrap();
        fs::write(game.join("DUNE2/DUNE2.EXE"), b"MZ\x90\x00").unwrap();
        fs::write(game.join("DUNE2/DOS4GW.EXE"), b"MZ\x90\x00").unwrap();
        fs::write(game.join("DUNE2/PLAY.BAT"), b"@echo off\r\nDUNE2.EXE\r\n").unwrap();
        fs::write(game.join("dosbox/dosbox"), b"binary").unwrap();
        fs::create_dir_all(build.join("package.pkg")).unwrap();

        let script = "find payload -print | cpio -o --quiet 2>/dev/null | gzip > package.pkg/Scripts";
        assert!(Command::new("/bin/sh")
            .arg("-c")
            .arg(script)
            .current_dir(&build)
            .status()
            .unwrap()
            .success());
        fs::remove_dir_all(build.join("payload")).unwrap();
        let pkg = base.join("game.pkg");
        assert!(Command::new("/usr/bin/xar")
            .arg("-cf")
            .arg(&pkg)
            .arg("package.pkg")
            .current_dir(&build)
            .status()
            .unwrap()
            .success());

        let dest = base.join("out");
        let result = unpack_game_archive(
            pkg.to_string_lossy().to_string(),
            dest.to_string_lossy().to_string(),
            false,
            false,
        )
        .expect("a Mac package needs no external unpacker");

        assert!(result.success);
        // The wrapped app's Resources/game is hoisted, engine and all.
        assert!(dest.join("DUNE2").is_dir());
        assert!(dest.join("dosbox").is_dir());
        // And the launcher is chosen over the DOS extender beside it.
        assert_eq!(result.discovered_executable.as_deref(), Some("PLAY.BAT"));
        assert_eq!(result.discovered_working_dir.as_deref(), Some("DUNE2"));

        let _ = fs::remove_dir_all(&base);
    }
}
