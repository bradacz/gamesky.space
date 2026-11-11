# 🕹️ GameSky.space

[![macOS](https://img.shields.io/badge/Platform-macOS%2011.0%2B%20(Apple%20Silicon%20%26%20Intel)-000000.svg?style=flat-square&logo=apple)](https://gamesky.space)
[![Tauri](https://img.shields.io/badge/Engine-Tauri%20v2%20%2B%20Rust-orange.svg?style=flat-square&logo=tauri)](https://tauri.app)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Donate-FFDD00.svg?style=flat-square&logo=buymeacoffee&logoColor=black)](https://www.buymeacoffee.com/mariantomay)

> **Modern retro gaming workstation and simple DOSBox manager engineered specifically for macOS.**  
> 100% direct 1-click launch, intelligent Virtual Drive Bay, authentic Sound Blaster 16 & Roland MT-32 synthesis, and bulletproof save state protection — zero terminal required.

---

![GameSky.space macOS App Screenshot](https://gamesky.space/app-screenshot.png)

---

## 🌟 Key Features

- **⚡ 1-Click Direct Launch (Zero Terminal):** Say goodbye to manually typing `mount c ~/games/...` and wrestling with arcane EMS/XMS command-line parameters. Double-click and play with automated environment initialization.
- **💿 Virtual Drive Bay:** Instant mounting for ISO, CUE/BIN, DMG, IMG floppies, and local macOS folders as virtual DOS drives `C:\` and `D:\`. Multi-disc swap support without touching a configuration file.
- **🎛️ Complete Sound Hardware Subsystem:**
  - Yamaha OPL3 FM synthesis (Sound Blaster 16 & Pro)
  - Gravis UltraSound (GUS) hardware emulation
  - Roland MT-32 / General MIDI bridge via macOS CoreAudio
  - PC Speaker simulation
- **🔒 Save Vault & Sandbox Checkpoints:** Recursive folder scanning and isolated backups prevent your hard-earned progress and game saves from being overwritten during reinstalls.
- **📺 VGA Scaler Engine:** Built-in presets for `normal2x`, `normal3x`, `advmame2x`, `hq2x`, and 4:3 aspect-ratio correction optimized for high-DPI Retina and UltraWide displays.
- **🌐 FreeDOS 1.4 Catalog:** 35 legal, license-verified open-source packages with automated CRC32 checksum verification.
- **🎮 ScummVM Games:** Adventure titles that run on ScummVM instead of DOSBox are detected and launched too, including GOG's macOS releases, which carry their own engine.
- **🦀 Rust & Tauri v2 Core:** Instant application boot, near-zero RAM footprint, and 100% native execution on Apple Silicon (M1/M2/M3/M4) and Intel Macs.

### Experimental: Windows games inside GameSky

The next version includes an embedded **BoxedWine** player for 32-bit Windows
games such as East Drive. The game renders inside the existing GameSky window;
no CrossOver, system Wine installation, Windows licence or Rosetta is required.

Choose **Add Game → Import game ZIP automatically** to unpack an archive, detect
its executable, and prepare the needed engine. Folder imports also detect Windows
PE executables. Missing Windows support downloads automatically when importing or
launching the game (approximately 120 MB, once per installation).
The optional runtime can also be installed in Configuration. GameSky verifies its SHA-256 checksums before
installing it. Import the game's folder or unpack its ZIP through Library Folder;
Detection uses executable contents rather than ZIP filenames or version hashes.
Known game profiles add compatible settings; unrecognised Windows games use the
generic player without game-specific switches. East Drive switches are selected
from capabilities advertised by its executable, including older builds.
Automatic detection does not imply compatibility with every Windows game. **Save & close** returns to the
library, and modified guest files persist separately for each game.

This integration is experimental. Rendering, controls, audio, save/reload and
frame rate must be tested on the target Mac before a public release. The runtime
supports 2D DirectDraw; it does not provide hardware-accelerated Direct3D.
The Windows layer uses Wine 11. East Drive’s client area fills the player without the emulated desktop or window frame,
with its aspect ratio preserved as the GameSky window resizes.
The default engine is the single-threaded JIT from upstream build 128, pinned to
commit `fe428d02abb494229a46d5121d2f856b3f7371a6`. Compatibility mode retains
the 26R1 interpreter. Guest files and Save Vault checkpoints use a per-game
`state.sav` ZIP snapshot in the app's `windows-saves` directory.
Source and licences: [BoxedWine](https://github.com/danoon2/Boxedwine/tree/fe428d02abb494229a46d5121d2f856b3f7371a6)
(GPL-2.0-or-later), [Wine](https://gitlab.winehq.org/wine/wine/-/tree/wine-11.0)
(LGPL-2.1-or-later). Game files are imported locally and are not bundled.

### Optional: unpacking Windows installers

GOG's **macOS** releases (`.pkg`) and ZIP archives unpack out of the box, with
no extra tools — that includes both the DOSBox-wrapped and ScummVM builds.

Unpacking **Inno Setup installers** — the format GOG and OldGames.sk use for
their **Windows** builds, and the only download some games offer — needs
`innoextract`, which is not bundled:

```bash
brew install innoextract     # GOG / OldGames.sk installers
brew install sevenzip        # optional, for 7z and RAR archives
```

The Library Folder view says so when a tool is missing, rather than failing at
unpack time.

---

## 🤝 Community & Development Support Welcome!

**GameSky.space** is built as an open-source tool for retro computing enthusiasts on Mac. **We warmly welcome contributions, testing, and feedback from the community!**

### How You Can Help:
1. 🐛 **Report Issues & Feature Requests:** Open a [GitHub Issue](https://github.com/bradacz/gamesky.space/issues) to report bugs, suggest enhancements, or propose new emulator features.
2. 🎮 **Game Profile Compatibility:** Test your favorite DOS classics and share optimal CPU cycles and sound configurations.
3. 💻 **Pull Requests:** Contributions to the React frontend, Tauri/Rust backend, sound engines, or documentation are very welcome!
4. ☕ **Support the Developer:** If you enjoy GameSky.space, consider buying the creator a coffee at [Buy Me A Coffee](https://www.buymeacoffee.com/mariantomay).

---

## 🚀 Development Setup

### Prerequisites
- Node.js 18+ and `npm`
- Rust 1.75+ and `cargo`
- macOS 11.0+ (Big Sur, Monterey, Ventura, Sonoma, Sequoia)

### Installation & Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/bradacz/gamesky.space.git
cd gamesky.space

# 2. Install dependencies
npm install

# 3. Start the web frontend in development mode
npm run dev

# 4. Launch the full native macOS application (Tauri v2 + Rust)
npm run tauri dev
```

---

## 🛠️ Build & Verification

```bash
# Verify TypeScript types and bundle frontend assets
npm run build

# Run Rust backend test suite
cargo test --manifest-path src-tauri/Cargo.toml

# Run Rust clippy linter with strict checks
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

---

## 📦 Signed macOS Distribution & Auto-Updater Deployment

GameSky.space includes an automated release pipeline for Apple Developer ID code signing, Apple Notarization, Minisign updater signing, and automated deployment to Bunny.net CDN:

```bash
# 1. Generate updater keys (run once)
npm run release:keys

# 2. Build signed & notarized macOS DMG locally
npm run release:macos

# 3. Deploy DMG, updater archives and latest.json to Bunny.net CDN
npm run release:bunny

# 4. Full All-in-One Release & Deploy
npm run release:deploy
```

For detailed setup, environment variables, and step-by-step instructions, see **[RELEASE.md](RELEASE.md)**.

---

## 📄 License & Legal Notice

This project is licensed under the **[MIT License](LICENSE)**.  
The underlying emulation runtime interfaces with open-source binaries and configurations from **DOSBox**, **DOSBox-Staging**, and **DOSBox-X** (licensed under GNU GPLv2). All original game titles, cover artwork, and trademarks belong to their respective copyright holders.

---

© 1995–2026 **GameSky.space** · Engineered with ❤️ in Rust & React for macOS.
