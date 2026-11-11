GameSky.space 1.2.0

- East Drive runs inside the GameSky window using optional open-source BoxedWine and Wine 11 support.
- Automatic ZIP import detects DOS and Windows executables, creates a game profile, and prepares missing Windows support.
- East Drive fills the player area while preserving its aspect ratio; guest files persist separately per game.
- Game detection uses executable headers rather than archive names or version hashes. East Drive launch switches follow the executable's advertised capabilities.
- The Windows player is experimental and supports 32-bit x86 games. Compatibility with other titles and versions must be tested; Windows game files are not included.

East Drive by Sledge:
https://www.high-voltage.cz/
https://www.high-voltage.cz/neretro/s-ai-muze-hry-delat-kazdy-a-tak-jsem-jednu-udelal/

Validation: frontend production build, Rust tests and Clippy; real ZIP import under an unrelated archive name; Signed Universal app and DMG accepted by Apple notarization and Gatekeeper; clean automatic runtime download/install, East Drive menus, driving (~58 FPS), and Save & close verified on the development Mac. Earlier gameplay was also confirmed by the user. Intel hardware gameplay has not been verified.
