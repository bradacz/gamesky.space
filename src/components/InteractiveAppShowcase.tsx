import React, { useState, useRef } from 'react';
import { retroAudio } from '../audio/retroSynth';

interface Hotspot {
  id: string;
  x: number; // percentage
  y: number; // percentage
  title: { cs: string; en: string };
  desc: { cs: string; en: string };
  tag: string;
}

const HOTSPOTS_CLASSIC: Hotspot[] = [
  {
    id: 'library',
    x: 18,
    y: 38,
    tag: 'LIBRARY',
    title: { cs: 'Knihovna DOS Her', en: 'DOS Game Library' },
    desc: {
      cs: 'Okamžitý přístup k nainstalovaným hrám s rychlým vyhledáváním a správou profilů.',
      en: 'Instant access to installed games with fast search and profile management.',
    },
  },
  {
    id: 'drivebay',
    x: 88,
    y: 28,
    tag: 'DRIVES & MEDIA',
    title: { cs: 'Virtuální Drive Bay', en: 'Virtual Drive Bay' },
    desc: {
      cs: 'Připojení ISO, CUE/BIN i 3.5" disketových obrazů bez nutnosti zadávat imgmount.',
      en: 'Mount ISO, CUE/BIN, and floppy images without typing imgmount commands.',
    },
  },
  {
    id: 'sound',
    x: 88,
    y: 73,
    tag: 'AUDIO ENGINE',
    title: { cs: 'SoundBlaster 16 & Roland', en: 'SoundBlaster 16 & Roland' },
    desc: {
      cs: 'Hardwarové směrování Port 220, IRQ 7, DMA 1 s macOS CoreAudio pro MIDI.',
      en: 'Hardware routing for Port 220, IRQ 7, DMA 1 with macOS CoreAudio MIDI bridge.',
    },
  },
  {
    id: 'cycles',
    x: 88,
    y: 52,
    tag: 'CPU GOVERNOR',
    title: { cs: 'Posuvník CPU Cyklů', en: 'CPU Cycles Slider' },
    desc: {
      cs: 'Plynulé ladění výkonu od 8088 přes 386 a 486 až po Pentium bez speed-bugů.',
      en: 'Smooth clock tuning from 8088, 386, and 486 up to Pentium without speed bugs.',
    },
  },
  {
    id: 'launch',
    x: 82,
    y: 82,
    tag: '1-CLICK RUN',
    title: { cs: 'Spuštění 1 Kliknutím', en: '1-Click Game Launch' },
    desc: {
      cs: 'Okamžitý start v nativním okně nebo celoobrazovkovém režimu.',
      en: 'Instant game launch in a native window or fullscreen mode.',
    },
  },
];

const HOTSPOTS_NEON: Hotspot[] = [
  {
    id: 'fkeys',
    x: 50,
    y: 91,
    tag: 'NORTON COMMANDER BAR',
    title: { cs: 'Funkční F1–F10 Klávesy', en: 'F1–F10 Commander Hotkeys' },
    desc: {
      cs: 'Autentická spodní lišta v retro DOS stylu pro bleskový import, správu katalogu a spouštění her.',
      en: 'Authentic retro DOS bottom bar for instant import, catalog management, and fast execution.',
    },
  },
  {
    id: 'profile',
    x: 48,
    y: 52,
    tag: 'WOLFENSTEIN 3D',
    title: { cs: 'Detailní Profil & Box Art', en: 'Game Profile & Box Art' },
    desc: {
      cs: 'Přímá vazba na spustitelný EXE soubor, vysoké rozlišení obalu a statistiky spuštění.',
      en: 'Direct link to the game executable, high-res vintage box art, and launch statistics.',
    },
  },
  {
    id: 'quicktools',
    x: 32,
    y: 17,
    tag: 'CYBER TOOLBAR',
    title: { cs: 'Nástroje & Import z Disku [A:]', en: 'Tools & Disk Import [A:]' },
    desc: {
      cs: 'Rychlé operace pro přidání hry [+], import z mechaniky [A:], správu uložených pozic [S] a katalog [@].',
      en: 'Fast actions for adding games [+], mounting physical disks [A:], save states [S], and catalog [@].',
    },
  },
  {
    id: 'drivebay_neon',
    x: 81,
    y: 30,
    tag: 'DRIVES & MEDIA',
    title: { cs: 'Disketová & CD-ROM Jednotka', en: 'Floppy & CD-ROM Bay' },
    desc: {
      cs: 'Správa Floppy A: a CD-ROM D: s tlačítky Browse, Image a okamžitým vysunutím (Eject).',
      en: 'Direct management of Floppy A: and CD-ROM D: with Browse, Disc Image, and Eject actions.',
    },
  },
  {
    id: 'hardware_neon',
    x: 81,
    y: 69,
    tag: 'DOSBOX HARDWARE LAB',
    title: { cs: 'CPU 10 000 Cyklů & SB16', en: 'CPU 10,000 Cycles & SB16' },
    desc: {
      cs: 'Posuvník 8088 až Pentium, VGA 320x200 škálování a SoundBlaster 16 s MIDI a zeleným RUN tlačítkem.',
      en: '8088 to Pentium slider, VGA 320x200 scaler, and SoundBlaster 16 with MIDI and big green Run button.',
    },
  },
];

interface InteractiveAppShowcaseProps {
  lang: 'cs' | 'en';
  topBarText: string;
  captionText: string;
}

export const InteractiveAppShowcase: React.FC<InteractiveAppShowcaseProps> = ({
  lang,
  topBarText,
  captionText,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [theme, setTheme] = useState<'classic' | 'neon'>('classic');
  const [transform, setTransform] = useState<string>('perspective(1200px) rotateX(0deg) rotateY(0deg)');
  const [spotlight, setSpotlight] = useState<{ x: number; y: number; opacity: number }>({ x: 0, y: 0, opacity: 0 });
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);

  const activeHotspots = theme === 'classic' ? HOTSPOTS_CLASSIC : HOTSPOTS_NEON;
  const currentImage = theme === 'classic' ? '/app-screenshot.png' : '/app-screenshot-alt.png';

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -5.5;
    const rotateY = ((x - centerX) / centerX) * 5.5;

    setTransform(`perspective(1200px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.015, 1.015, 1.015)`);
    setSpotlight({ x, y, opacity: 1 });
  };

  const handleMouseLeave = () => {
    setTransform('perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
    setSpotlight((prev) => ({ ...prev, opacity: 0 }));
  };

  const handleHotspotClick = (h: Hotspot, e: React.MouseEvent) => {
    e.stopPropagation();
    retroAudio.playBlip();
    setActiveHotspot(activeHotspot?.id === h.id ? null : h);
  };

  const handleThemeSwitch = (newTheme: 'classic' | 'neon') => {
    if (newTheme === theme) return;
    retroAudio.playSwitchClick(newTheme === 'neon');
    setTheme(newTheme);
    setActiveHotspot(null);
  };

  return (
    <div
      ref={containerRef}
      className="hero-screenshot-showcase"
      style={{
        transform,
        transition: 'transform 0.12s ease-out',
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Top Window Bar with Traffic Lights & Retro Theme Switcher */}
      <div className="screenshot-top-bar">
        <div className="screenshot-traffic-lights">
          <span className="screenshot-t-dot s-red" />
          <span className="screenshot-t-dot s-yellow" />
          <span className="screenshot-t-dot s-green" />
        </div>

        {/* Alternative Look Toggle Selector */}
        <div className="showcase-theme-switcher" role="tablist">
          <button
            type="button"
            className={`theme-switch-pill ${theme === 'classic' ? 'theme-active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              handleThemeSwitch('classic');
            }}
          >
            <span>🕹️</span>
            <span>{lang === 'cs' ? 'Klasický vzhled' : 'Classic Workstation'}</span>
          </button>
          <button
            type="button"
            className={`theme-switch-pill ${theme === 'neon' ? 'theme-active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              handleThemeSwitch('neon');
            }}
          >
            <span>⚡</span>
            <span>{lang === 'cs' ? 'Cyber Commander' : 'Cyber Commander'}</span>
          </button>
        </div>

        <span className="showcase-live-badge">
          ● {theme === 'classic' ? topBarText : (lang === 'cs' ? 'CYBER COMMANDER EDICE' : 'CYBER COMMANDER EDITION')}
        </span>
      </div>

      {/* Main Image Container with Hotspots */}
      <div className="screenshot-img-wrapper" style={{ position: 'relative', overflow: 'hidden' }}>
        <img
          key={theme}
          src={currentImage}
          alt={theme === 'classic' ? 'GameSky.space Classic Workstation' : 'GameSky.space Cyber Commander Edition'}
          className="screenshot-img-fluid"
        />

        {/* Dynamic Specular Light Glare */}
        <div
          className="specular-glare-layer"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            opacity: spotlight.opacity,
            background: `radial-gradient(500px circle at ${spotlight.x}px ${spotlight.y}px, rgba(255, 230, 0, 0.15), rgba(0, 168, 232, 0.08) 40%, transparent 70%)`,
            transition: 'opacity 0.2s ease',
            zIndex: 10,
          }}
        />

        {/* Laser Scanline Beam Sweep */}
        <div className="laser-scan-line" />

        {/* Interactive Hotspots Pins */}
        {activeHotspots.map((h) => {
          const isActive = activeHotspot?.id === h.id;
          return (
            <div
              key={h.id}
              className={`hotspot-pin-root ${isActive ? 'hotspot-active' : ''}`}
              style={{
                position: 'absolute',
                left: `${h.x}%`,
                top: `${h.y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 20,
              }}
              onClick={(e) => handleHotspotClick(h, e)}
              title={h.title[lang]}
            >
              <div className="hotspot-beacon-pulse" />
              <button className="hotspot-beacon-btn">
                <span>+</span>
              </button>

              {/* Popover Callout */}
              {isActive && (
                <div
                  className="hotspot-callout-bubble"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="callout-tag">[{h.tag}]</div>
                  <div className="callout-title">{h.title[lang]}</div>
                  <div className="callout-desc">{h.desc[lang]}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="screenshot-caption-tag">
        {theme === 'classic'
          ? captionText
          : (lang === 'cs'
              ? '📸 ALTERNATIVNÍ CYBER COMMANDER VZHLED S NORTON COMMANDER LIŠTOU (F1–F10) A RYCHLÝM OVLÁDÁNÍM'
              : '📸 ALTERNATIVE CYBER COMMANDER DARK THEME WITH NORTON COMMANDER F1–F10 BOTTOM BAR')}
      </div>
    </div>
  );
};
