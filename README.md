# GameSky.space 1.2.0

GameSky.space is a free, open-source macOS game library and launcher for DOS games,
ScummVM adventures, and selected older 32-bit Windows 95/98 games. It manages
launch profiles, game imports, disc media, artwork, and save-file backups.

**[Download the signed Universal DMG](https://game-sky-space.b-cdn.net/gamesky.space/releases/GameSky.space_1.2.0_universal.dmg)** ·
[Website](https://gamesky.space/) · [Release notes](RELEASE-NOTES-1.2.0.md)

One installer contains both **Apple Silicon (arm64) and Intel (x86_64)** builds.
The app targets macOS 11 or later. Embedded Windows compatibility also depends
on the WebKit features available on the target Mac.

![GameSky.space on macOS](https://gamesky.space/app-screenshot.png)

## Supported engines

| Engine | What GameSky supports | Setup |
| --- | --- | --- |
| [DOSBox](https://www.dosbox.com/) | Classic DOS games, generated launch configurations, mounted game folders and media | Detect or select an installed DOSBox executable |
| [DOSBox Staging](https://dosbox-staging.github.io/) | DOS game profiles using the Staging engine | Detect or select an installed Staging executable |
| [DOSBox-X](https://dosbox-x.com/) | DOS game profiles using DOSBox-X | Detect or select an installed DOSBox-X executable |
| [ScummVM](https://www.scummvm.org/) | Detect and launch supported adventure-game data, including compatible GOG packages | Use a configured installation or a compatible ScummVM engine included in the game package |
| [BoxedWine](https://www.boxedwine.org/) | Embedded WebAssembly player for selected 32-bit x86 Windows games | Downloaded and verified automatically when needed |
| [Wine 11](https://www.winehq.org/) | Windows compatibility layer running inside BoxedWine | Included in the optional Windows runtime; no system Wine installation required |

DOSBox settings apply to the selected DOS engine. ScummVM and Windows games use
separate launch paths; DOS CPU cycles, DOS sound-card settings, and DOS controller
profiles do not configure the embedded Windows player.

## New in 1.2.0: Windows games and East Drive

- **Play inside GameSky:** the Windows player renders in the existing application
  window, without a separate Wine window.
- **East Drive support:** its game image fills the player area, preserves its
  aspect ratio, and resizes with the window.
- **Automatic ZIP import:** choose **Add Game → Import game ZIP automatically**.
  GameSky extracts the archive into a new folder, detects the executable, creates
  a profile, and prepares missing Windows support. Existing installations are
  not overwritten by this import flow.
- **Automatic engine preparation:** the first Windows import or launch downloads
  approximately 120 MB of optional runtime files and checks their SHA-256 hashes.
  Initial setup requires internet access. The engine can also be installed in
  Configuration, and a failed download can be retried by launching the game again.
- **Detection beyond a single archive or version:** Windows executables are
  recognised by their PE headers rather than archive filenames. Known games can
  use dedicated profiles; other titles use the generic player. The East Drive
  profile passes only switches advertised by that executable.
- **Persistent guest files:** changed files are stored separately for each game.
  **Save & close** writes them and returns to the library. Save Vault can back up
  the resulting per-game `state.sav` file.

East Drive is a retro racing game by Sledge. Download its game files separately:
[author's game page](https://sledgehv.itch.io/east-drive),
[high-voltage.cz](https://www.high-voltage.cz/), and
[the article about creating the game](https://www.high-voltage.cz/neretro/s-ai-muze-hry-delat-kazdy-a-tak-jsem-jednu-udelal/).
Game files are **not bundled** with GameSky.

### Windows compatibility limits

Windows support is **experimental**. The current player supports **32-bit x86
executables** and 2D DirectDraw rendering. It does not provide hardware-accelerated
Direct3D, or support for 64-bit and ARM Windows executables. Recognising an EXE
or importing a ZIP does not guarantee that the game will run.

East Drive 0.9 beta 26 menus, driving, embedded display, clean runtime installation,
and Save & close were tested on the development Mac; gameplay was also confirmed
by the user. Other game versions, titles, macOS versions, and Intel hardware need
separate compatibility testing. There is no hard-coded requirement for that
specific East Drive release, but future builds can introduce new dependencies.

The player uses the upstream single-threaded BoxedWine JIT from build 128, pinned
to commit `fe428d02abb494229a46d5121d2f856b3f7371a6`, with Wine 11. Compatibility
mode offers the 26R1 interpreter. No CrossOver, Windows installation, or Rosetta
is required for this embedded runtime.

## Game imports and library management

| Input | Support |
| --- | --- |
| Local game folder | Inspect DOS/Windows executables and detect compatible ScummVM data |
| ZIP archive | Built-in extraction, including archives using Windows path separators; automatic import available |
| GOG macOS `.pkg` | Extract supported package payloads, read available game metadata, and locate DOSBox or ScummVM game data |
| Windows Inno Setup installer | Detect installer signature; extraction requires external `innoextract` |
| 7z / RAR archive | Extraction requires a supported external unpacking tool, such as `sevenzip` |
| CD-ROM or floppy media | Select images or mounted folders and configure media through the chosen DOS engine |

**LIB** shows installed games, ScummVM folders, archives, empty folders, and sizes.
It offers extraction, adding games, and visibility controls. **LAUNCH FILE** lets
you correct an automatically chosen executable. Games can have custom artwork,
favourites, recently played entries, play counts, and tracked play time.

For optional archive tools:

```bash
brew install innoextract
brew install sevenzip
```

GameSky reports missing extraction tools. Supported disc-image formats and
mounting behaviour depend on the DOSBox variant; a detected image is not a
promise that every engine supports that format.

## DOS configuration, media, sound, and controls

- Automatic compatibility presets and conservative settings based on game
  metadata, with manual overrides.
- CPU cycles, memory, graphics machine, aspect correction, fullscreen, and
  scaler settings, including Normal2x/3x, AdvMAME2x, and HQ2x.
- Sound Blaster device, port, IRQ, DMA, and MIDI configuration passed to DOSBox;
  actual synthesis and device support are supplied by the selected engine.
- CD-ROM and floppy mounting, local folders, and multi-disc media sets with
  swapping or separate drive assignments.
- Per-game keyboard/joystick templates for platformers, FPS games, adventures,
  racing games, and native joystick input; mapper files and dead-zone options.
- Setup-program selection, launch diagnostics, repair actions, and optional
  Norton Commander integration.

## Saves, downloads, and appearance

- **Save Vault:** scan save files, create named checkpoints, restore them, and
  open their location in Finder. Checkpoints back up files; they are **not
  snapshots of running emulator memory**.
- Export/import library backups and duplicate game profiles.
- A FreeDOS 1.4 catalogue with 35 open-source packages and checksum verification;
  additional catalogue entries use their source's available downloads.
- Custom artwork, Apple Light, classic Win95, Norton Commander, and DOS-style
  themes, optional UI sound effects, and app fullscreen.
- Signed Universal DMG releases, Apple notarization, and signed automatic
  updates distributed through Bunny.net.

## Development

The app uses Tauri 2, Rust, and TypeScript/Vite. The CI configuration uses Node.js
22 and the stable Rust toolchain. macOS release builds also need Xcode command-line
tools, both Rust target architectures, and the signing credentials described in
[RELEASE.md](RELEASE.md).

```bash
git clone https://github.com/bradacz/gamesky.space.git
cd gamesky.space
npm install
npm run tauri dev
```

`npm run dev` starts the browser-only interface at `/app.html`; native file import,
engine installation, and game launching require the Tauri desktop application.
The public download website has a separate source repository:
[gamasky-space-web](https://github.com/bradacz/gamasky-space-web), deployed through
GitHub to Cloudflare Pages.

```bash
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

The real-archive import test can be run with a local copy of East Drive:

```bash
GAMESKY_TEST_EAST_DRIVE_ARCHIVE=/path/to/east-drive.zip \
  cargo test --manifest-path src-tauri/Cargo.toml imports_real_east_drive_archive -- --ignored
```

Release commands:

```bash
npm run release:macos   # Build, sign, notarize, and verify the Universal installer
npm run release:bunny   # Publish verified artifacts and updater metadata
```

See [RELEASE.md](RELEASE.md) for the release workflow. Signing credentials and
private keys belong in ignored local files, never in Git.

## Contributing and licences

Report compatibility results and bugs in
[GitHub Issues](https://github.com/bradacz/gamesky.space/issues), join the
[discussion](https://github.com/bradacz/gamesky.space/discussions/1), or
[support development](https://www.buymeacoffee.com/mariantomay).

GameSky source is released under the [MIT licence](LICENSE). DOSBox variants,
ScummVM, BoxedWine, and Wine retain their own licences. In particular,
[BoxedWine source](https://github.com/danoon2/Boxedwine/tree/fe428d02abb494229a46d5121d2f856b3f7371a6)
is GPL-2.0-or-later and
[Wine 11 source](https://gitlab.winehq.org/wine/wine/-/tree/wine-11.0)
is LGPL-2.1-or-later. Game files, artwork, and trademarks belong to their owners.
