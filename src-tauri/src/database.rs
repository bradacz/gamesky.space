use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use serde::Serialize;
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const SCHEMA_VERSION: i64 = 1;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseStatus {
    pub path: String,
    pub schema_version: i64,
    pub game_count: i64,
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve the GameSky.space data folder: {error}"))?;
    fs::create_dir_all(&app_data)
        .map_err(|error| format!("Failed to create the GameSky.space data folder: {error}"))?;
    Ok(app_data.join("gamesky-space.sqlite3"))
}

fn open_database(app: &AppHandle) -> Result<Connection, String> {
    let path = database_path(app)?;
    let connection = Connection::open(path)
        .map_err(|error| format!("Failed to open the GameSky.space database: {error}"))?;
    connection
        .execute_batch(
            "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;",
        )
        .map_err(|error| format!("Failed to configure the GameSky.space database: {error}"))?;
    ensure_schema(&connection)?;
    Ok(connection)
}

fn ensure_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS app_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS preferences (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                payload_json TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS games (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                profile_json TEXT NOT NULL,
                favorite INTEGER NOT NULL DEFAULT 0,
                last_played INTEGER,
                play_time_seconds INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS games_title_idx ON games(title COLLATE NOCASE);
            CREATE INDEX IF NOT EXISTS games_last_played_idx ON games(last_played DESC);

            CREATE TABLE IF NOT EXISTS play_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
                started_at INTEGER NOT NULL,
                ended_at INTEGER,
                duration_seconds INTEGER,
                emulator_type TEXT,
                exit_status TEXT
            );

            CREATE TABLE IF NOT EXISTS diagnostic_results (
                game_id TEXT PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
                checked_at INTEGER NOT NULL,
                status TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS collections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS collection_games (
                collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
                game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
                position INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (collection_id, game_id)
            );

            CREATE TABLE IF NOT EXISTS artwork_assets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
                kind TEXT NOT NULL,
                local_path TEXT,
                source_url TEXT,
                source_name TEXT,
                checksum TEXT,
                attribution TEXT,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS input_profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                emulator_type TEXT NOT NULL,
                mapper_json TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS install_jobs (
                id TEXT PRIMARY KEY,
                game_id TEXT,
                state TEXT NOT NULL,
                progress REAL NOT NULL DEFAULT 0,
                payload_json TEXT NOT NULL,
                error_message TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            ",
        )
        .map_err(|error| format!("Failed to create the GameSky.space database schema: {error}"))?;

    connection
        .execute(
            "INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?1, ?2)",
            params![SCHEMA_VERSION, now_millis()],
        )
        .map_err(|error| format!("Failed to record the database schema version: {error}"))?;
    Ok(())
}

#[derive(Default)]
struct LegacyWebKitData {
    games_json: Option<String>,
    preferences_json: Option<String>,
    game_count: usize,
}

fn decode_webkit_string(value: Vec<u8>) -> Option<String> {
    if !value.len().is_multiple_of(2) {
        return String::from_utf8(value).ok();
    }
    let utf16 = value
        .chunks_exact(2)
        .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
        .collect::<Vec<_>>();
    String::from_utf16(&utf16).ok()
}

fn find_local_storage_databases(
    directory: &std::path::Path,
    depth: usize,
    results: &mut Vec<PathBuf>,
) {
    if depth > 7 {
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
            find_local_storage_databases(&path, depth + 1, results);
        } else if file_type.is_file()
            && path.file_name().and_then(|name| name.to_str()) == Some("localstorage.sqlite3")
        {
            results.push(path);
        }
    }
}

fn read_legacy_webkit_data() -> LegacyWebKitData {
    let mut best = LegacyWebKitData::default();
    let Some(home) = dirs::home_dir() else {
        return best;
    };
    let roots = [
        home.join("Library/WebKit/com.retro.dosboxstudio"),
        home.join("Library/WebKit/dosbox-retro-studio"),
    ];
    let mut databases = Vec::new();
    for root in roots {
        find_local_storage_databases(&root, 0, &mut databases);
    }

    for path in databases {
        let Ok(connection) = Connection::open_with_flags(
            path,
            OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        ) else {
            continue;
        };
        let read_value = |key: &str| -> Option<String> {
            let bytes = connection
                .query_row(
                    "SELECT value FROM ItemTable WHERE key = ?1",
                    params![key],
                    |row| row.get::<_, Vec<u8>>(0),
                )
                .optional()
                .ok()
                .flatten()?;
            decode_webkit_string(bytes)
        };
        let games_json = read_value("dosbox_retro_studio_games");
        let count = games_json
            .as_deref()
            .and_then(|json| serde_json::from_str::<Vec<Value>>(json).ok())
            .map(|games| games.len())
            .unwrap_or(0);
        if count >= best.game_count {
            best.game_count = count;
            best.games_json = games_json;
            best.preferences_json = read_value("dosbox_retro_studio_prefs");
        }
    }
    best
}

#[tauri::command]
pub fn database_initialize(app: AppHandle) -> Result<DatabaseStatus, String> {
    let path = database_path(&app)?;
    let connection = open_database(&app)?;
    let game_count = connection
        .query_row("SELECT COUNT(*) FROM games", [], |row| row.get(0))
        .map_err(|error| format!("Failed to inspect the game library: {error}"))?;
    Ok(DatabaseStatus {
        path: path.to_string_lossy().to_string(),
        schema_version: SCHEMA_VERSION,
        game_count,
    })
}

#[tauri::command]
pub fn database_import_legacy(
    app: AppHandle,
    games_json: String,
    preferences_json: String,
) -> Result<DatabaseStatus, String> {
    let path = database_path(&app)?;
    let mut connection = open_database(&app)?;
    let existing_games: i64 = connection
        .query_row("SELECT COUNT(*) FROM games", [], |row| row.get(0))
        .map_err(|error| format!("Failed to inspect the game library: {error}"))?;

    let passed_game_count = serde_json::from_str::<Vec<Value>>(&games_json)
        .map(|games| games.len())
        .unwrap_or(0);
    let legacy_webkit = read_legacy_webkit_data();
    let source_games_json = if legacy_webkit.game_count > passed_game_count {
        legacy_webkit.games_json.as_deref().unwrap_or(&games_json)
    } else {
        &games_json
    };

    if existing_games == 0 {
        save_games_on_connection(&mut connection, source_games_json)?;
    }

    let has_preferences: bool = connection
        .query_row("SELECT 1 FROM preferences WHERE id = 1", [], |_| Ok(true))
        .optional()
        .map_err(|error| format!("Failed to inspect preferences: {error}"))?
        .unwrap_or(false);
    let source_preferences_json = if serde_json::from_str::<Value>(&preferences_json).is_ok()
        && preferences_json.trim() != "{}"
    {
        &preferences_json
    } else {
        legacy_webkit
            .preferences_json
            .as_ref()
            .unwrap_or(&preferences_json)
    };
    if !has_preferences && serde_json::from_str::<Value>(source_preferences_json).is_ok() {
        connection
            .execute(
                "INSERT INTO preferences(id, payload_json, updated_at) VALUES (1, ?1, ?2)",
                params![source_preferences_json, now_millis()],
            )
            .map_err(|error| format!("Failed to migrate preferences: {error}"))?;
    }

    connection
        .execute(
            "INSERT OR REPLACE INTO app_meta(key, value) VALUES ('legacy_local_storage_migrated', 'true')",
            [],
        )
        .map_err(|error| format!("Failed to finish the legacy migration: {error}"))?;

    let game_count = connection
        .query_row("SELECT COUNT(*) FROM games", [], |row| row.get(0))
        .map_err(|error| format!("Failed to inspect the migrated library: {error}"))?;
    Ok(DatabaseStatus {
        path: path.to_string_lossy().to_string(),
        schema_version: SCHEMA_VERSION,
        game_count,
    })
}

#[tauri::command]
pub fn database_load_games(app: AppHandle) -> Result<String, String> {
    let connection = open_database(&app)?;
    let mut statement = connection
        .prepare("SELECT profile_json FROM games ORDER BY title COLLATE NOCASE")
        .map_err(|error| format!("Failed to read the game library: {error}"))?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| format!("Failed to read the game library: {error}"))?;
    let mut games = Vec::<Value>::new();
    for row in rows {
        let payload = row.map_err(|error| format!("Failed to read a game profile: {error}"))?;
        if let Ok(game) = serde_json::from_str::<Value>(&payload) {
            games.push(game);
        }
    }
    serde_json::to_string(&games)
        .map_err(|error| format!("Failed to encode the game library: {error}"))
}

#[tauri::command]
pub fn database_save_games(app: AppHandle, games_json: String) -> Result<(), String> {
    let mut connection = open_database(&app)?;
    save_games_on_connection(&mut connection, &games_json)?;
    let preferences_json = connection
        .query_row(
            "SELECT payload_json FROM preferences WHERE id = 1",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| format!("Failed to read preferences for backup: {error}"))?
        .unwrap_or_else(|| "{}".to_string());
    drop(connection);
    write_automatic_backup(&app, &games_json, &preferences_json)
}

fn write_automatic_backup(
    app: &AppHandle,
    games_json: &str,
    preferences_json: &str,
) -> Result<(), String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve backup folder: {error}"))?;
    let backup_dir = app_data.join("automatic-backups");
    fs::create_dir_all(&backup_dir)
        .map_err(|error| format!("Failed to create backup folder: {error}"))?;

    // One coalesced backup per UTC day avoids a copy for every UI adjustment.
    let day = now_millis() / 86_400_000;
    let target = backup_dir.join(format!("gamesky-space-{day}.json"));
    let temporary = backup_dir.join(format!(".gamesky-space-{day}.tmp"));
    let payload = serde_json::json!({
        "format": "gamesky-space-backup",
        "version": 1,
        "createdAt": now_millis(),
        "games": serde_json::from_str::<Value>(games_json).unwrap_or(Value::Array(Vec::new())),
        "preferences": serde_json::from_str::<Value>(preferences_json).unwrap_or(Value::Object(Default::default()))
    });
    fs::write(
        &temporary,
        serde_json::to_vec_pretty(&payload).map_err(|error| error.to_string())?,
    )
    .map_err(|error| format!("Failed to write automatic backup: {error}"))?;
    fs::rename(&temporary, &target)
        .map_err(|error| format!("Failed to publish automatic backup: {error}"))?;

    let mut backups = fs::read_dir(&backup_dir)
        .map_err(|error| format!("Failed to inspect automatic backups: {error}"))?
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            let modified = entry.metadata().ok()?.modified().ok()?;
            (path.extension().and_then(|value| value.to_str()) == Some("json"))
                .then_some((modified, path))
        })
        .collect::<Vec<_>>();
    backups.sort_by_key(|(modified, _)| *modified);
    let remove_count = backups.len().saturating_sub(10);
    for (_, path) in backups.into_iter().take(remove_count) {
        let _ = fs::remove_file(path);
    }
    Ok(())
}

fn save_games_on_connection(connection: &mut Connection, games_json: &str) -> Result<(), String> {
    let games = serde_json::from_str::<Vec<Value>>(games_json)
        .map_err(|error| format!("The game library is not valid JSON: {error}"))?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Failed to start a library transaction: {error}"))?;
    let existing_ids = {
        let mut statement = transaction
            .prepare("SELECT id FROM games")
            .map_err(|error| format!("Failed to inspect existing games: {error}"))?;
        let rows = statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|error| format!("Failed to inspect existing games: {error}"))?;
        rows.filter_map(Result::ok).collect::<Vec<_>>()
    };
    let updated_at = now_millis();
    let mut retained_ids = HashSet::new();

    for game in games {
        let id = game
            .get("id")
            .and_then(Value::as_str)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "A game profile is missing its id".to_string())?;
        let title = game
            .get("title")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| format!("Game profile '{id}' is missing its title"))?;
        let favorite = game
            .get("favorite")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let last_played = game.get("lastPlayed").and_then(Value::as_i64);
        let play_time_seconds = game
            .get("playTimeSeconds")
            .and_then(Value::as_i64)
            .or_else(|| {
                game.get("playTimeMinutes")
                    .and_then(Value::as_i64)
                    .map(|minutes| minutes * 60)
            })
            .unwrap_or(0);
        let created_at = game
            .get("createdAt")
            .and_then(Value::as_i64)
            .unwrap_or(updated_at);
        let profile_json = serde_json::to_string(&game)
            .map_err(|error| format!("Failed to encode game profile '{id}': {error}"))?;
        retained_ids.insert(id.to_string());

        transaction
            .execute(
                "INSERT INTO games(id, title, profile_json, favorite, last_played, play_time_seconds, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                 ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    profile_json = excluded.profile_json,
                    favorite = excluded.favorite,
                    last_played = excluded.last_played,
                    play_time_seconds = excluded.play_time_seconds,
                    updated_at = excluded.updated_at",
                params![id, title, profile_json, favorite as i64, last_played, play_time_seconds, created_at, updated_at],
            )
            .map_err(|error| format!("Failed to save game profile '{title}': {error}"))?;
    }

    for id in existing_ids {
        if !retained_ids.contains(&id) {
            transaction
                .execute("DELETE FROM games WHERE id = ?1", params![id])
                .map_err(|error| format!("Failed to remove a deleted game profile: {error}"))?;
        }
    }

    transaction
        .commit()
        .map_err(|error| format!("Failed to commit the game library: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saving_library_preserves_relational_history() {
        let mut connection = Connection::open_in_memory().expect("memory database");
        ensure_schema(&connection).expect("schema");
        let games = r#"[{"id":"game-one","title":"Game One","createdAt":1}]"#;
        save_games_on_connection(&mut connection, games).expect("initial save");
        connection
            .execute(
                "INSERT INTO play_sessions(game_id, started_at) VALUES ('game-one', 1)",
                [],
            )
            .expect("session");
        connection
            .execute(
                "INSERT INTO diagnostic_results(game_id, checked_at, status, payload_json) VALUES ('game-one', 1, 'ok', '[]')",
                [],
            )
            .expect("diagnostic");

        save_games_on_connection(&mut connection, games).expect("second save");
        let sessions: i64 = connection
            .query_row("SELECT COUNT(*) FROM play_sessions", [], |row| row.get(0))
            .expect("session count");
        let diagnostics: i64 = connection
            .query_row("SELECT COUNT(*) FROM diagnostic_results", [], |row| {
                row.get(0)
            })
            .expect("diagnostic count");
        assert_eq!(sessions, 1);
        assert_eq!(diagnostics, 1);
    }
}

#[tauri::command]
pub fn database_load_preferences(app: AppHandle) -> Result<Option<String>, String> {
    let connection = open_database(&app)?;
    connection
        .query_row(
            "SELECT payload_json FROM preferences WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| format!("Failed to load preferences: {error}"))
}

#[tauri::command]
pub fn database_save_preferences(app: AppHandle, preferences_json: String) -> Result<(), String> {
    serde_json::from_str::<Value>(&preferences_json)
        .map_err(|error| format!("Preferences are not valid JSON: {error}"))?;
    let connection = open_database(&app)?;
    connection
        .execute(
            "INSERT INTO preferences(id, payload_json, updated_at) VALUES (1, ?1, ?2)
             ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at",
            params![preferences_json, now_millis()],
        )
        .map_err(|error| format!("Failed to save preferences: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn database_save_diagnostics(
    app: AppHandle,
    game_id: String,
    status: String,
    payload_json: String,
) -> Result<(), String> {
    if !matches!(status.as_str(), "ok" | "warning" | "error") {
        return Err("Invalid diagnostic status".to_string());
    }
    serde_json::from_str::<Value>(&payload_json)
        .map_err(|error| format!("Diagnostic result is not valid JSON: {error}"))?;
    let connection = open_database(&app)?;
    connection
        .execute(
            "INSERT INTO diagnostic_results(game_id, checked_at, status, payload_json) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(game_id) DO UPDATE SET checked_at = excluded.checked_at, status = excluded.status, payload_json = excluded.payload_json",
            params![game_id, now_millis(), status, payload_json],
        )
        .map_err(|error| format!("Failed to save diagnostic result: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn database_start_play_session(
    app: AppHandle,
    game_id: String,
    emulator_type: String,
) -> Result<i64, String> {
    let connection = open_database(&app)?;
    connection
        .execute(
            "INSERT INTO play_sessions(game_id, started_at, emulator_type) VALUES (?1, ?2, ?3)",
            params![game_id, now_millis(), emulator_type],
        )
        .map_err(|error| format!("Failed to start the play session: {error}"))?;
    Ok(connection.last_insert_rowid())
}

#[tauri::command]
pub fn database_finish_play_session(
    app: AppHandle,
    session_id: i64,
    exit_status: String,
) -> Result<i64, String> {
    let mut connection = open_database(&app)?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("Failed to finish the play session: {error}"))?;
    let (game_id, started_at): (String, i64) = transaction
        .query_row(
            "SELECT game_id, started_at FROM play_sessions WHERE id = ?1 AND ended_at IS NULL",
            params![session_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|error| format!("The play session was not found: {error}"))?;
    let ended_at = now_millis();
    let duration_seconds = ((ended_at - started_at) / 1000).max(0);
    transaction
        .execute(
            "UPDATE play_sessions SET ended_at = ?1, duration_seconds = ?2, exit_status = ?3 WHERE id = ?4",
            params![ended_at, duration_seconds, exit_status, session_id],
        )
        .map_err(|error| format!("Failed to update the play session: {error}"))?;
    transaction
        .execute(
            "UPDATE games SET last_played = ?1, play_time_seconds = play_time_seconds + ?2, updated_at = ?1 WHERE id = ?3",
            params![ended_at, duration_seconds, game_id],
        )
        .map_err(|error| format!("Failed to update the game's play time: {error}"))?;
    transaction
        .commit()
        .map_err(|error| format!("Failed to commit the play session: {error}"))?;
    Ok(duration_seconds)
}
