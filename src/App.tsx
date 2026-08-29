import React, { useState, useEffect } from 'react';
import { retroAudio } from './audio/retroSynth';
import { InteractiveAppShowcase } from './components/InteractiveAppShowcase';
import { CookieBanner } from './components/CookieBanner';
import { FullPageSkyBackground } from './components/FullPageSkyBackground';
import './styles/retro.css';

type Lang = 'cs' | 'en';
type ModalType = 'gdpr' | 'license' | null;

const I18N = {
  cs: {
    mastheadVol: 'VOL. 01 • ISSUE 09/95 • EXKLUZIVNÍ REPORTÁŽ',
    mastheadPrice: 'CENA: ZDARMA / OPEN-SOURCE',
    navCompare: 'Strana 1: Proč GameSky',
    navHardware: 'Strana 2: Hardware lab',
    navDownload: 'Strana 3: Stažení',
    btnNavDownload: 'Stažení DMG',
    btnNavDiscussions: 'Diskuse',
    btnBmcNav: 'Koupit kávu',
    btnBmcHero: 'Pozvat na kávu',
    btnHeroDiscussions: 'Diskusní fórum',
    bmcInfoTitle: 'Líbí se vám GameSky.space?',
    bmcInfoDesc: 'GameSky je vyvíjen jako bezplatný open-source projekt. Můžete podpořit další vývoj a nové funkce pozváním na kávu.',
    btnBmcCard: 'Buy me a coffee',
    stickerBadge: '★ VERIFIED RUST & TAURI V2 CORE ★',
    heroKicker: 'REPORTÁŽ MĚSÍCE • RUBRIKA: RETRO COMPUTING',
    heroTitle1: 'Čas na 640 KB paměti a 256 barev.',
    heroTitleHighlight: 'Retro',
    heroTitle2: 'bez složité konfigurace.',
    heroLead: 'Konec úmorného vypisování příkazů, manuálního ladění EMS paměti a konfliktů zvukových karet. GameSky.space přináší kompletní, jednoduchý správce DOSBoxu pro moderní macOS.',
    btnHeroDownload: 'STÁHNOUT pro macOS (.DMG)',
    btnHeroSound: 'Otestovat Sound Blaster 16',
    screenshotTopBar: 'NATIVNÍ BĚHOVÉ PROSTŘEDÍ PRO MACOS • TAURI V2 + RUST',
    screenshotCaption: '📸 AUTENTICKÝ SNÍMEK OBRAZOVKY APLIKACE GAMESKY.SPACE V MACOS',
    chapter2Num: 'KAPITOLA I • SROVNÁVACÍ TEST',
    chapter2Title: 'Konec utrpení s příkazovým řádkem',
    chapter2Deck: 'Proč je ruční spouštění DOSBoxu noční můrou a jak to GameSky.space řeší jednou provždy.',
    compareBadHeader: '❌ RUČNÍ SPOUŠTĚNÍ DOSBOXU',
    compareBadTitle: 'Zdlouhavé a náchylné k chybám',
    compareBad1: 'Psaní cest a parametrů: Nutnost neustále zadávat mount c ~/games/doom a pamatovat si syntaxi.',
    compareBad2: 'Kolize 8.3 aliasů na macOS: Moderní cesty a mezery v názvech často způsobí zhroucení DOS příkazů.',
    compareBad3: 'Chybějící konvence pro ISO: Složité parametry pro imgmount u vícediskových her.',
    compareBad4: 'Ztráta uložených pozic: Žádné automatické zálohování savů před přeinstalací.',
    compareGoodHeader: '✅ S GAMESKY.SPACE ENGINE',
    compareGoodTitle: 'Stačí jeden klik',
    compareGood1: '1-Click přímé spuštění: Dvojklik a aplikace se postará o celou inicializaci.',
    compareGood2: 'Automatické CPU profily: Optimální cykly pro 386, 486 i Pentium bez speed-bugů.',
    compareGood3: 'Chytrý Drive Bay: Okamžité připojení ISO, CUE/BIN i disket bez příkazové řádky.',
    compareGood4: 'Save Vault & Checkpointy: Sandboxové zálohování zabraňuje přepsání vašeho postupu.',
    chapter3Num: 'KAPITOLA II • HARDWARE LAB',
    chapter3Title: 'Kompletní hardwarový subsystém',
    chapter3Deck: 'Všechny technologie éry PC 90. let optimalizované pro moderní macOS.',
    tile1Title: 'Sound Blaster 16 & MIDI',
    tile1Desc: 'Yamaha OPL3 FM syntéza, Gravis UltraSound a macOS CoreAudio bridge pro Roland MT-32.',
    tile1Btn: '🎵 Přehrát OPL3 FM znělku',
    tile2Title: 'Virtual Drive Bay',
    tile2Desc: 'Podpora .iso, .cue/.bin, .img disket i lokálních složek Macu jako disku C:\\.',
    tile2Btn: '💾 Zvuk mechaniky A:\\',
    tile3Title: 'Save Vault Sandbox',
    tile3Desc: 'Rekurzivní skenování zachovává stromovou strukturu adresářů a spolehlivě chrání uložené pozice.',
    tile3Status: '🔒 Zero Data Loss ochrana',
    tile4Title: 'VGA Scaler Engine',
    tile4Desc: 'Režimy normal2x, normal3x, advmame2x, hq2x a korekce poměru 4:3 pro Retina displeje.',
    tile4Status: 'Mode 13h (256 barev)',
    tile5Title: 'FreeDOS 1.4 Katalog',
    tile5Desc: '35 oficiálních open-source balíčků s automatickou kontrolou kontrolních součtů CRC32.',
    tile5Status: '100% Legální & Ověřeno',
    tile6Title: 'Rust & Tauri v2 Core',
    tile6Desc: 'Nativní kód pro Apple Silicon (M1–M4) i Intel. Bleskový start a nulová zbytečná spotřeba RAM.',
    tile6Status: '0% Electron junk',
    downloadTag: 'STÁHNOUT PLNOU VERZI',
    downloadHeadlinePre: 'STÁHNĚTE SI',
    downloadHeadlinePost: 'PRO macOS',
    downloadSubtitle: 'Plná verze pro macOS je k dispozici zdarma pod open-source licencí.',
    btnDownloadMain: '💾 STÁHNOUT PRO macOS (.DMG)',
    downloadSpecs: 'Verze 1.0.0 • Apple Silicon M1-M4 & Intel • 64-bit',
    sealQuality: 'SEAL OF QUALITY ★★★★★',
    offlineReady: '100% OFFLINE READY',
    footerBlock1Title: '💾 PODPOROVANÉ DOSBOX ENGINE',
    footerBlock2Title: '🌐 Odkazy',
    footerBlock3Title: '⚖️ Info',
    footerGdpr: 'GDPR, Cookies & Hosting',
    footerLicenseLink: 'Licence MIT & GPLv2',
    footerDiscussions: 'Diskuse #1',
    footerLicenseNote: 'GameSky.space je nezávislý open-source software publikovaný pod licencí MIT. Emulační jádro spolupracuje s DOSBox, DOSBox-Staging a DOSBox-X (GPLv2). Všechny registrované ochranné známky a názvy her náleží jejich původním vlastníkům.',
    footerCopy: 'GameSky.space © 1995–2026. Vyvinuto v Rustu a Tauri v2 pro macOS.',
    gdprTitle: 'ZÁSADY OCHRANY SOUKROMÍ, COOKIES & HOSTING',
    gdprSecHosting: '1. Hosting & Infrastruktura (Cloudflare Pages & Google Sites):',
    gdprP1: 'Tento web je hostován ve bezplatném tarifu na platformách Cloudflare Pages a Google Sites. Tyto platformy zaznamenávají standardní technické síťové logy (IP adresy, typ prohlížeče, čas požadavku) výhradně za účelem doručování obsahu přes CDN, zabezpečení proti DDoS útokům a diagnostiky infrastruktury.',
    gdprSecCookies: '2. Cookies & Lokální paměť prohlížeče (LocalStorage):',
    gdprP2: 'Web může využívat nezbytné technické cookies poskytovatelů hostingu (Cloudflare). Váš prohlížeč si do lokálního úložiště (localStorage) ukládá pouze vaši volbu jazyka (cs/en) a potvrzení cookie lišty. Žádné marketingové ani sledovací reklamní cookies nepoužíváme.',
    gdprSecApp: '3. Desktopová aplikace GameSky.space pro macOS:',
    gdprP3: 'Samotná aplikace GameSky.space pro macOS funguje 100% lokálně na vašem počítači a neodesílá žádná uživatelská data, herní knihovny ani savy na žádné externí servery.',
    licenseTitle: 'LICENČNÍ PODMÍNKY A AUTORSKÁ PRÁVA',
    licenseP1: 'GameSky.space je šířen jako svobodný open-source software pod licencí MIT. Můžete jej volně používat, studovat zdrojový kód a přizpůsobovat svým potřebám.',
    licenseP2: 'Emulační subsystém využívá binární komponenty a konfigurace kompatibilní s projekty DOSBox, DOSBox-Staging a DOSBox-X (licencováno pod GNU GPLv2).',
  },
  en: {
    mastheadVol: 'VOL. 01 • ISSUE 09/95 • SPECIAL FEATURE REPORT',
    mastheadPrice: 'PRICE: FREE / OPEN-SOURCE',
    navCompare: 'Page 1: Why GameSky',
    navHardware: 'Page 2: Hardware Lab',
    navDownload: 'Page 3: Download',
    btnNavDownload: 'Download DMG',
    btnNavDiscussions: 'Discussions',
    btnBmcNav: 'Buy a coffee',
    btnBmcHero: 'Buy me a coffee',
    btnHeroDiscussions: 'Discussion Forum',
    bmcInfoTitle: 'Enjoying GameSky.space?',
    bmcInfoDesc: 'GameSky is developed as a free open-source tool. You can support continued development by buying me a coffee.',
    btnBmcCard: 'Buy me a coffee',
    stickerBadge: '★ VERIFIED RUST & TAURI V2 CORE ★',
    heroKicker: 'FEATURE OF THE MONTH • SECTION: RETRO COMPUTING',
    heroTitle1: 'Time for 640 KB Memory & 256 Colors.',
    heroTitleHighlight: 'Retro gaming',
    heroTitle2: 'without complex setup.',
    heroLead: 'Say goodbye to typing endless terminal commands, manually tuning EMS memory, and fighting audio IRQ conflicts. GameSky.space brings a complete, simple DOSBox manager for modern macOS.',
    btnHeroDownload: 'DOWNLOAD for macOS (.DMG)',
    btnHeroSound: 'Test Sound Blaster 16',
    screenshotTopBar: 'NATIVE RUNTIME ENVIRONMENT FOR MACOS • TAURI V2 + RUST',
    screenshotCaption: '📸 AUTHENTIC SCREENSHOT OF GAMESKY.SPACE APP RUNNING ON MACOS',
    chapter2Num: 'CHAPTER I • BENCHMARK TEST',
    chapter2Title: 'No More Command-Line Frustration',
    chapter2Deck: 'Why manual DOSBox configuration is a chore, and how GameSky.space solves it once and for all.',
    compareBadHeader: '❌ MANUAL DOSBOX SETUP',
    compareBadTitle: 'Tedious and Prone to Errors',
    compareBad1: 'Typing paths and parameters: Having to constantly write mount c ~/games/doom and remember exact syntax.',
    compareBad2: 'macOS 8.3 alias collisions: Modern paths and special characters often cause DOS commands to fail.',
    compareBad3: 'Cumbersome ISO mounting: Complex parameters required for imgmount on multi-disc CD-ROM games.',
    compareBad4: 'Lost game save files: No automated checkpoint backups before reinstalls or directory changes.',
    compareGoodHeader: '✅ WITH GAMESKY.SPACE ENGINE',
    compareGoodTitle: 'Just a Single Click',
    compareGood1: '1-Click Direct Launch: Double-click to play and the app takes care of full initialization.',
    compareGood2: 'Automated CPU Profiles: Optimal cycles for 386, 486, and Pentium without speed bugs.',
    compareGood3: 'Smart Drive Bay: Instant mounting of ISO, CUE/BIN, and floppy images without CLI.',
    compareGood4: 'Save Vault & Checkpoints: Sandboxed backups protect your game saves from being overwritten.',
    chapter3Num: 'CHAPTER II • HARDWARE LAB',
    chapter3Title: 'Complete Hardware Subsystem',
    chapter3Deck: 'All 90s PC gaming technologies engineered and optimized for modern macOS.',
    tile1Title: 'Sound Blaster 16 & MIDI',
    tile1Desc: 'Yamaha OPL3 FM synthesis, Gravis UltraSound, and macOS CoreAudio bridge for Roland MT-32.',
    tile1Btn: '🎵 Play OPL3 FM Jingle',
    tile2Title: 'Virtual Drive Bay',
    tile2Desc: 'Support for .iso, .cue/.bin, .img floppies, and local Mac folders as virtual drive C:\\.',
    tile2Btn: '💾 Drive A:\\ Stepper Sound',
    tile3Title: 'Save Vault Sandbox',
    tile3Desc: 'Recursive scanning preserves folder hierarchies and reliably protects your saved games.',
    tile3Status: '🔒 Zero Data Loss Protection',
    tile4Title: 'VGA Scaler Engine',
    tile4Desc: 'Modes normal2x, normal3x, advmame2x, hq2x, and 4:3 aspect correction for Retina displays.',
    tile4Status: 'Mode 13h (256 Colors)',
    tile5Title: 'FreeDOS 1.4 Catalog',
    tile5Desc: '35 official open-source packages with automatic published CRC32 checksum verification.',
    tile5Status: '100% Legal & Verified',
    tile6Title: 'Rust & Tauri v2 Core',
    tile6Desc: 'Native binary for Apple Silicon (M1–M4) and Intel. Instant launch and zero memory bloat.',
    tile6Status: '0% Electron Junk',
    downloadTag: 'DOWNLOAD FULL RELEASE',
    downloadHeadlinePre: 'DOWNLOAD',
    downloadHeadlinePost: 'FOR macOS',
    downloadSubtitle: 'The full macOS version is available completely free under an open-source license.',
    btnDownloadMain: '💾 DOWNLOAD FOR macOS (.DMG)',
    downloadSpecs: 'Version 1.0.0 • Apple Silicon M1-M4 & Intel • 64-bit Universal',
    sealQuality: 'SEAL OF QUALITY ★★★★★',
    offlineReady: '100% OFFLINE READY',
    footerBlock1Title: '💾 SUPPORTED DOS ENGINES',
    footerBlock2Title: '🌐 Links',
    footerBlock3Title: '⚖️ Info',
    footerGdpr: 'GDPR, Cookies & Hosting',
    footerLicenseLink: 'MIT & GPLv2 License',
    footerDiscussions: 'Discussion #1',
    footerLicenseNote: 'GameSky.space is independent open-source software released under the MIT License. The emulation runtime integrates with DOSBox, DOSBox-Staging, and DOSBox-X (GPLv2). All registered trademarks and game titles belong to their respective copyright holders.',
    footerCopy: 'GameSky.space © 1995–2026. Built with Rust and Tauri v2 for macOS.',
    gdprTitle: 'PRIVACY POLICY, COOKIES & HOSTING NOTICE',
    gdprSecHosting: '1. Hosting & Infrastructure (Cloudflare Pages & Google Sites):',
    gdprP1: 'This website is hosted on the free tier of Cloudflare Pages and Google Sites. These hosting providers record standard technical network logs (IP addresses, user agents, request timestamps) strictly for CDN edge delivery, DDoS attack mitigation, and infrastructure reliability.',
    gdprSecCookies: '2. Cookies & Local Storage (LocalStorage):',
    gdprP2: 'This website may use essential technical cookies provided by Cloudflare for CDN security. In addition, your browser stores your language preference (cs/en) and cookie notice acknowledgement in local storage. No advertising or behavioral tracking cookies are used.',
    gdprSecApp: '3. GameSky.space macOS Desktop Application:',
    gdprP3: 'The GameSky.space macOS desktop app runs 100% locally on your computer and never transmits personal data, game library contents, or save files to external servers.',
    licenseTitle: 'LICENSE TERMS & COPYRIGHT INFORMATION',
    licenseP1: 'GameSky.space is released as free open-source software under the MIT License. You are free to run, modify, study, and distribute this software.',
    licenseP2: 'The underlying emulation engine uses configurations and binaries compatible with DOSBox, DOSBox-Staging, and DOSBox-X (licensed under the GNU General Public License v2).',
  },
};

export const App: React.FC = () => {
  const [lang, setLang] = useState<Lang>('en');
  const [modal, setModal] = useState<ModalType>(null);

  // Automatic language detection: Czech / Slovak users get 'cs', all others get 'en'
  useEffect(() => {
    const saved = localStorage.getItem('gamesky_lang');
    if (saved === 'cs' || saved === 'en') {
      setLang(saved);
      return;
    }

    const browserLangs = navigator.languages || [navigator.language || ''];
    let isCzechOrSlovak = false;

    for (const l of browserLangs) {
      const low = l.toLowerCase();
      if (low.startsWith('cs') || low.startsWith('sk')) {
        isCzechOrSlovak = true;
        break;
      }
    }

    const detected: Lang = isCzechOrSlovak ? 'cs' : 'en';
    setLang(detected);
  }, []);

  const handleLangToggle = (newLang: Lang) => {
    setLang(newLang);
    localStorage.setItem('gamesky_lang', newLang);
    retroAudio.playBlip();
  };

  const openModal = (type: ModalType) => {
    setModal(type);
    retroAudio.playBlip();
  };

  const closeModal = () => {
    setModal(null);
    retroAudio.playBlip();
  };

  const t = I18N[lang];

  const handleTestAudio = (type: 'opl3' | 'roland') => {
    if (type === 'opl3') {
      retroAudio.playSoundBlasterJingle();
    } else {
      retroAudio.playRolandFanfare();
    }
  };

  return (
    <div className="print-magazine-root">
      {/* FULL-PAGE NIGHT TO DAY PIXEL SKY BACKGROUND */}
      <FullPageSkyBackground />

      {/* COOKIE & HOSTING NOTICE BANNER */}
      <CookieBanner lang={lang} onOpenDetails={() => openModal('gdpr')} />

      {/* 1. TOP MAGAZINE MASTHEAD BAR */}
      <div className="magazine-masthead">
        <span>{t.mastheadVol}</span>
        <span className="masthead-barcode">|||||||||||||||||||||||</span>
        <span>GameSky.space • macOS DOS ENGINE</span>
        <span className="masthead-price">{t.mastheadPrice}</span>
      </div>

      {/* 2. MAIN EDITORIAL NAVBAR */}
      <nav className="editorial-navbar">
        <div className="navbar-container">
          <a href="#hero" className="navbar-brand-badge">
            <div className="brand-icon-wrapper">
              <img src="/app-icon.png" alt="GameSky Logo" className="brand-logo-img" />
            </div>
            <div className="brand-text-block">
              <div className="brand-logo-text">
                GameSky<span className="brand-tld-pill">.space</span>
              </div>
              <div className="brand-subline-badge">RETRO DOS WORKSTATION</div>
            </div>
          </a>

          <div className="navbar-links">
            <a href="#compare" className="nav-tab-btn">{t.navCompare}</a>
            <a href="#hardware" className="nav-tab-btn">{t.navHardware}</a>
            <a href="#download" className="nav-tab-btn">{t.navDownload}</a>
          </div>

          <div className="navbar-actions-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Buy Me a Coffee Nav Button */}
            <a
              href="https://www.buymeacoffee.com/mariantomay"
              target="_blank"
              rel="noreferrer"
              className="btn-nav-bmc"
              title="Buy me a coffee"
            >
              <span>☕</span>
              <span>{t.btnBmcNav}</span>
            </a>

            {/* GitHub Repo Button */}
            <a
              href="https://github.com/bradacz/gamesky.space"
              target="_blank"
              rel="noreferrer"
              className="btn-nav-github"
              title="GitHub Repository"
            >
              <span>🐙</span>
              <span>GitHub</span>
            </a>

            {/* GitHub Discussions Nav Button */}
            <a
              href="https://github.com/bradacz/gamesky.space/discussions/1"
              target="_blank"
              rel="noreferrer"
              className="btn-nav-discussions"
              title="GitHub Discussions"
            >
              <span>💬</span>
              <span>{t.btnNavDiscussions}</span>
            </a>

            <a href="#download" className="btn-nav-tearoff">
              <span>💾</span>
              <span>{t.btnNavDownload}</span>
            </a>
          </div>
        </div>
      </nav>

      {/* 3. HERO EDITORIAL SPREAD */}
      <header id="hero" className="hero-spread">
        <div className="hero-editorial-box">
          <div className="sticker-badge-float">
            {t.stickerBadge}
          </div>

          <div className="hero-kicker-tag">
            {t.heroKicker}
          </div>

          <h1 className="hero-main-title">
            {t.heroTitle1}<br />
            <span className="highlight-yellow">{t.heroTitleHighlight}</span> {t.heroTitle2}
          </h1>

          <p className="hero-lead-text">
            {t.heroLead}
          </p>

          <div className="hero-action-toolbar">
            <a href="#download" className="btn-editorial-primary">
              <span>💾</span>
              <span>{t.btnHeroDownload}</span>
            </a>
            <button
              className="btn-editorial-secondary"
              onClick={() => handleTestAudio('opl3')}
            >
              <span>🎵</span>
              <span>{t.btnHeroSound}</span>
            </button>
            <a
              href="https://github.com/bradacz/gamesky.space/discussions/1"
              target="_blank"
              rel="noreferrer"
              className="btn-editorial-discussions"
              title="GitHub Discussions"
            >
              <span>💬</span>
              <span>{t.btnHeroDiscussions}</span>
            </a>
            <a
              href="https://www.buymeacoffee.com/mariantomay"
              target="_blank"
              rel="noreferrer"
              className="btn-editorial-bmc"
              title="Buy me a coffee"
            >
              <span>☕</span>
              <span>{t.btnBmcHero}</span>
            </a>
          </div>

          {/* INTERACTIVE APP SCREENSHOT SHOWCASE */}
          <InteractiveAppShowcase
            lang={lang}
            topBarText={t.screenshotTopBar}
            captionText={t.screenshotCaption}
          />
        </div>
      </header>

      {/* 4. COMPARISON ARTICLE SPREAD */}
      <section id="compare" className="editorial-spread-section">
        <div className="editorial-spread-box">
          <div className="section-editorial-header">
            <div className="sec-title-group">
              <span className="sec-chapter-num">{t.chapter2Num}</span>
              <h2 className="sec-headline">{t.chapter2Title}</h2>
              <p className="sec-deck">{t.chapter2Deck}</p>
            </div>
          </div>

          <div className="editorial-compare-grid">
            {/* Card: Then */}
            <div className="compare-magazine-card compare-card-bad">
              <span className="compare-stamp-header stamp-bad">{t.compareBadHeader}</span>
              <h3 className="compare-card-title">{t.compareBadTitle}</h3>
              <ul className="compare-list-editorial">
                <li>
                  <span>✖</span>
                  <div>{t.compareBad1}</div>
                </li>
                <li>
                  <span>✖</span>
                  <div>{t.compareBad2}</div>
                </li>
                <li>
                  <span>✖</span>
                  <div>{t.compareBad3}</div>
                </li>
                <li>
                  <span>✖</span>
                  <div>{t.compareBad4}</div>
                </li>
              </ul>
            </div>

            {/* Card: Now */}
            <div className="compare-magazine-card compare-card-good">
              <span className="compare-stamp-header stamp-good">{t.compareGoodHeader}</span>
              <h3 className="compare-card-title">{t.compareGoodTitle}</h3>
              <ul className="compare-list-editorial">
                <li>
                  <span>✔</span>
                  <div>{t.compareGood1}</div>
                </li>
                <li>
                  <span>✔</span>
                  <div>{t.compareGood2}</div>
                </li>
                <li>
                  <span>✔</span>
                  <div>{t.compareGood3}</div>
                </li>
                <li>
                  <span>✔</span>
                  <div>{t.compareGood4}</div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 5. HARDWARE LAB TILES */}
      <section id="hardware" className="editorial-spread-section">
        <div className="editorial-spread-box">
          <div className="section-editorial-header">
            <div className="sec-title-group">
              <span className="sec-chapter-num">{t.chapter3Num}</span>
              <h2 className="sec-headline">{t.chapter3Title}</h2>
              <p className="sec-deck">{t.chapter3Deck}</p>
            </div>
          </div>

          <div className="editorial-hardware-grid">
            {/* Tile 1 */}
            <div className="hardware-tile">
              <div>
                <div className="tile-icon-box">🎛️</div>
                <h3 className="tile-title">{t.tile1Title}</h3>
                <p className="tile-body">{t.tile1Desc}</p>
              </div>
              <button className="btn-tile-action" onClick={() => handleTestAudio('opl3')}>
                {t.tile1Btn}
              </button>
            </div>

            {/* Tile 2 */}
            <div className="hardware-tile">
              <div>
                <div className="tile-icon-box">💿</div>
                <h3 className="tile-title">{t.tile2Title}</h3>
                <p className="tile-body">{t.tile2Desc}</p>
              </div>
              <button className="btn-tile-action" onClick={() => retroAudio.playFloppySeek()}>
                {t.tile2Btn}
              </button>
            </div>

            {/* Tile 3 */}
            <div className="hardware-tile">
              <div>
                <div className="tile-icon-box">💾</div>
                <h3 className="tile-title">{t.tile3Title}</h3>
                <p className="tile-body">{t.tile3Desc}</p>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 800, color: 'var(--cmyk-green)' }}>
                {t.tile3Status}
              </div>
            </div>

            {/* Tile 4 */}
            <div className="hardware-tile">
              <div>
                <div className="tile-icon-box">📺</div>
                <h3 className="tile-title">{t.tile4Title}</h3>
                <p className="tile-body">{t.tile4Desc}</p>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 800 }}>
                {t.tile4Status}
              </div>
            </div>

            {/* Tile 5 */}
            <div className="hardware-tile">
              <div>
                <div className="tile-icon-box">🌐</div>
                <h3 className="tile-title">{t.tile5Title}</h3>
                <p className="tile-body">{t.tile5Desc}</p>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 800, color: 'var(--cmyk-green)' }}>
                {t.tile5Status}
              </div>
            </div>

            {/* Tile 6 */}
            <div className="hardware-tile">
              <div>
                <div className="tile-icon-box">🦀</div>
                <h3 className="tile-title">{t.tile6Title}</h3>
                <p className="tile-body">{t.tile6Desc}</p>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 800, color: 'var(--cmyk-blue)' }}>
                {t.tile6Status}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CLEAN DOWNLOAD & SUPPORT SECTION */}
      <section id="download" className="shareware-coupon-section">
        <div className="perforated-coupon-card">
          <div className="coupon-scissors-tag">
            ★ {t.downloadTag} ★
          </div>

          <h2 className="coupon-headline">
            <span>{t.downloadHeadlinePre}</span>
            <div className="navbar-brand-badge coupon-brand-badge">
              <div className="brand-icon-wrapper">
                <img src="/app-icon.png" alt="GameSky Logo" className="brand-logo-img" />
              </div>
              <div className="brand-text-block">
                <div className="brand-logo-text">
                  GameSky<span className="brand-tld-pill">.space</span>
                </div>
                <div className="brand-subline-badge">RETRO DOS WORKSTATION</div>
              </div>
            </div>
            <span>{t.downloadHeadlinePost}</span>
          </h2>

          <p className="coupon-subtitle">
            {t.downloadSubtitle}
          </p>

          <a
            href="https://github.com/bradacz/gamesky.space/releases"
            target="_blank"
            rel="noreferrer"
            className="btn-coupon-download"
            onClick={() => retroAudio.playVictory()}
          >
            <span>{t.btnDownloadMain}</span>
            <span className="coupon-subtext">{t.downloadSpecs}</span>
          </a>

          {/* BUY ME A COFFEE SUPPORT BOX */}
          <div className="coupon-bmc-box">
            <div className="bmc-box-text-group">
              <div className="bmc-box-title">☕ {t.bmcInfoTitle}</div>
              <div className="bmc-box-sub">{t.bmcInfoDesc}</div>
            </div>
            <a
              href="https://www.buymeacoffee.com/mariantomay"
              target="_blank"
              rel="noreferrer"
              className="btn-card-bmc"
            >
              <span>☕</span>
              <span>{t.btnBmcCard}</span>
            </a>
          </div>

          <div className="coupon-barcode-row">
            <span>{t.sealQuality}</span>
            <span style={{ letterSpacing: '4px', fontSize: '16px' }}>||||||||||||||||||||||||||||</span>
            <span>{t.offlineReady}</span>
          </div>
        </div>
      </section>

      {/* 7. UNIFIED COMPACT EDITORIAL FOOTER */}
      <footer className="editorial-footer">
        <div className="footer-container">
          <div className="footer-compact-grid">
            {/* Block 1: Supported DOSBox Versions */}
            <div className="footer-compact-card">
              <div className="footer-compact-title">
                {t.footerBlock1Title}
              </div>
              <div className="footer-compact-chips">
                <a
                  href="https://www.dosbox.com"
                  target="_blank"
                  rel="noreferrer"
                  className="footer-chip-link"
                >
                  <span>🕹️</span>
                  <span>DOSBox 0.74-3</span>
                </a>
                <a
                  href="https://dosbox-staging.github.io"
                  target="_blank"
                  rel="noreferrer"
                  className="footer-chip-link"
                >
                  <span>⚡</span>
                  <span>Staging</span>
                </a>
                <a
                  href="https://dosbox-x.com"
                  target="_blank"
                  rel="noreferrer"
                  className="footer-chip-link"
                >
                  <span>💻</span>
                  <span>DOSBox-X</span>
                </a>
              </div>
            </div>

            {/* Block 2: Partner Links */}
            <div className="footer-compact-card">
              <div className="footer-compact-title">
                {t.footerBlock2Title}
              </div>
              <div className="footer-compact-chips">
                <a
                  href="https://loftp.space"
                  target="_blank"
                  rel="noreferrer"
                  className="footer-chip-link"
                >
                  <span>🪐</span>
                  <span>loftp.space</span>
                </a>
                <a
                  href="https://l-cms.site"
                  target="_blank"
                  rel="noreferrer"
                  className="footer-chip-link"
                >
                  <span>⚡</span>
                  <span>l-cms.site</span>
                </a>
                <a
                  href="https://fitrepairstudio.site"
                  target="_blank"
                  rel="noreferrer"
                  className="footer-chip-link"
                >
                  <span>🛠️</span>
                  <span>fitrepairstudio.site</span>
                </a>
                <a
                  href="https://promethe.fun"
                  target="_blank"
                  rel="noreferrer"
                  className="footer-chip-link"
                >
                  <span>🎮</span>
                  <span>promethe.fun</span>
                </a>
              </div>
            </div>

            {/* Block 3: Legal & Info */}
            <div className="footer-compact-card">
              <div className="footer-compact-title">
                {t.footerBlock3Title}
              </div>
              <div className="footer-compact-chips">
                <button
                  onClick={() => openModal('gdpr')}
                  className="footer-chip-link"
                >
                  <span>🔒</span>
                  <span>{t.footerGdpr}</span>
                </button>
                <button
                  onClick={() => openModal('license')}
                  className="footer-chip-link"
                >
                  <span>📜</span>
                  <span>{t.footerLicenseLink}</span>
                </button>
                <a
                  href="https://github.com/bradacz/gamesky.space"
                  target="_blank"
                  rel="noreferrer"
                  className="footer-chip-link"
                >
                  <span>🐙</span>
                  <span>GitHub</span>
                </a>
                <a
                  href="https://github.com/bradacz/gamesky.space/discussions/1"
                  target="_blank"
                  rel="noreferrer"
                  className="footer-chip-link"
                >
                  <span>💬</span>
                  <span>{t.footerDiscussions}</span>
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Compact Single Strip */}
          <div className="footer-bottom-strip">
            {/* Language Switcher */}
            <div className="lang-switcher-box">
              <button
                className={`btn-lang-toggle ${lang === 'cs' ? 'lang-active' : ''}`}
                onClick={() => handleLangToggle('cs')}
                title="Čeština"
              >
                🇨🇿 CS
              </button>
              <span className="lang-sep">|</span>
              <button
                className={`btn-lang-toggle ${lang === 'en' ? 'lang-active' : ''}`}
                onClick={() => handleLangToggle('en')}
                title="English"
              >
                🇬🇧 EN
              </button>
            </div>

            {/* Center Copyright & Summary */}
            <div className="footer-strip-center">
              <p className="footer-license-note">
                {t.footerLicenseNote}
              </p>
              <p className="footer-editorial-copy">
                {t.footerCopy}
              </p>
            </div>

            {/* Right Sublink */}
            <a
              href="https://www.mylocalio.com"
              target="_blank"
              rel="noreferrer"
              className="footer-sublink"
            >
              www.mylocalio.com
            </a>
          </div>
        </div>
      </footer>

      {/* EDITORIAL LEGAL MODAL (GDPR / LICENSE) */}
      {modal && (
        <div className="editorial-modal-overlay" onClick={closeModal}>
          <div className="editorial-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {modal === 'gdpr' ? t.gdprTitle : t.licenseTitle}
              </div>
              <button className="modal-close-btn" onClick={closeModal}>
                ✕
              </button>
            </div>
            <div className="modal-body-content">
              {modal === 'gdpr' ? (
                <>
                  <p><strong>{t.gdprSecHosting}</strong></p>
                  <p>{t.gdprP1}</p>
                  <p><strong>{t.gdprSecCookies}</strong></p>
                  <p>{t.gdprP2}</p>
                  <p><strong>{t.gdprSecApp}</strong></p>
                  <p>{t.gdprP3}</p>
                </>
              ) : (
                <>
                  <p><strong>Open-Source MIT:</strong> {t.licenseP1}</p>
                  <p><strong>Kompatibilita GPLv2:</strong> {t.licenseP2}</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
