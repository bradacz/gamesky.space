# Finální audit GameSky.space

Datum: 28. 8. 2026

## Výsledek

Schválený implementační plán je zapracovaný. Nativní launcher pracuje jen s reálnými daty, katalog se otevírá, legálně instalovatelné balíčky se stahují bezpečnou nativní cestou a skutečná hra se spustí jedním kliknutím s automaticky vytvořenou konfigurací DOSBoxu.

Identita aplikace je sjednocena na `GameSky.space`, bundle identifier je `space.gamesky.desktop` a copyright je `© 2026 ma_xx · Brada_cz`. Systémová ikona, favicon a distribuční formáty používají vlastní pixelový motiv GameSky.space s monogramem `GS`.

## Implementované oblasti

### Knihovna a perzistence

- SQLite se schématem, migracemi, WAL a tabulkami pro hry, preference, relace, diagnostiku, kolekce, artworky, ovladače a instalační úlohy.
- Migrace dřívějších WebKit/localStorage dat ze starých bundle identifikátorů.
- UPSERT ukládání knihovny bez mazání relační historie; regresní test ověřuje zachování relací a diagnostiky.
- Automatická denní záloha s rotací deseti kopií a přenosný validovaný `.gsky` ZIP.
- Žádné vzorové profily; načítají se jen skutečné hry z disku nebo instalace provedené aplikací.

### Import, konfigurace a spuštění

- Průvodce prvním spuštěním, detekce DOSBox/DOSBox Staging/DOSBox-X a sken knihovny.
- Rekurzivní chytrý import s hodnocením executable a potlačením instalátorů, konfigurátorů, odinstalátorů a Windows programů.
- Kompatibilní profil s důvodem a mírou jistoty; ruční nastavení uživatele se zamkne proti automatickému přepsání.
- Kontrola emulátoru, složky, pracovního adresáře, executable a média před každým startem.
- Přímý start z řádku, dvojklikem, hlavním `RUN GAME` nebo klávesou F9 bez ručních DOS příkazů.
- Herní relace se ukončením procesu doplní o délku a exit status; dočasná konfigurace se odstraní.

### Média, CD-ROM a ovladače

- ISO, CUE/BIN, IMG, NRG, MDS/MDF, floppy obrazy, připojené fyzické CD a složky z interního disku, HDD nebo flashdisku.
- Ověření CUE závislostí a ochrana před traversal cestami.
- Správce více disků: jedno médium, výměna disků a samostatné DOS jednotky.
- Per-game mapper profily pro platformovky, FPS, adventury, závodní hry a nativní mapování.

### Katalog, downloady a artwork

- 35 FreeDOS 1.4 položek s licencí a publikovaným CRC32.
- Automatická Internet Archive instalace pouze pro backendem vynucený allowlist ověřených sharewarových položek. Ostatní jsou označené `SOURCE ONLY` a vyžadují legálně vlastněná data.
- Rust HTTPS downloader s timeouty, třemi pokusy, omezenými redirect hosty a limity velikosti.
- Kontrola ZIP signatury, CRC, bezpečné rozbalení ve staging adresáři a ochrana proti zip-slip.
- Artwork cache pouze z `thumbnails.libretro.com` a `archive.org`, s kontrolou typu, hostitele a limitu 8 MiB.

### UI, bezpečnost a aktualizace

- Ručně navržený moderní Norton Commander motiv, katalogové karty, trvale viditelné `RUN GAME`, F-klávesová lišta a drobný copyright.
- Oddělený webový vstup `index.html` a desktopový launcher `app.html`; souběžná webová prezentace nebyla přepsána.
- CSP, lokální fonty launcheru, omezený asset protocol, validace URL, cest, názvů a velikostí.
- Tauri updater s ruční i volitelnou automatickou kontrolou a podepsaným feedem na doméně GameSky.space.
- Universal macOS release skripty, DMG layout, GitHub Actions workflow, Developer ID/notarizace a ověření Gatekeeper/stapler.

## Provedené kontroly

- `npm run build`: OK; build obsahuje web i launcher.
- `npm audit --omit=dev`: 0 známých zranitelností.
- `cargo test`: 7 lokálních testů prošlo, 2 síťové smoke testy jsou standardně ignorované.
- `cargo clippy --all-targets -- -D warnings`: OK.
- `npm run audit:archive`: 74/74 katalogových ZIP URL dostupných (39 Internet Archive, 35 FreeDOS).
- Debug macOS `.app` a `.dmg`: sestaveno; kontrolní součet DMG přes `hdiutil verify`: VALID.
- UI smoke test: launcher otevřel `tauri://localhost/app.html`, katalog zobrazil 68 reálných položek a práva `SOURCE ONLY`/ověřená licence.
- Přímý start: Dune II se spustilo v DOSBox Staging na 8000 cyklech bez příkazového dialogu.
- Po ukončení hry UI ukázalo 2 spuštění a 22 sekund; SQLite obsahuje 4 hry, 1 relaci a 1 diagnostiku. Tím je ověřená oprava zachování relační historie.
- Diagnostika Dune II: emulátor, složka, executable i média prošly.

## Jediný externí release krok

Lokální debug DMG je funkční, ale není distribuovatelně podepsaný: na tomto Macu není aktuálně viditelná žádná platná identita `Developer ID Application`, chybí Apple notarizační proměnné a `GAMESKY_UPDATER_PUBKEY`. Jakmile budou tyto údaje zpřístupněné procesu nebo vložené jako GitHub Actions secrets, příkaz `npm run release:macos` provede Universal build, podpis, notarizaci, stapling a finální ověření automaticky.

