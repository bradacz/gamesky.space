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
- **🦀 Rust & Tauri v2 Core:** Instant application boot, near-zero RAM footprint, and 100% native execution on Apple Silicon (M1/M2/M3/M4) and Intel Macs.

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

## 📦 Signed macOS Distribution (DMG)

The release script packages a Universal macOS binary (Apple Silicon + Intel) with Developer ID code signing, Apple notarization submission, and Gatekeeper verification:

```bash
npm run release:macos
```

---

## 📄 License & Legal Notice

This project is licensed under the **[MIT License](LICENSE)**.  
The underlying emulation runtime interfaces with open-source binaries and configurations from **DOSBox**, **DOSBox-Staging**, and **DOSBox-X** (licensed under GNU GPLv2). All original game titles, cover artwork, and trademarks belong to their respective copyright holders.

---

© 1995–2026 **GameSky.space** · Engineered with ❤️ in Rust & React for macOS.
