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

const HOTSPOTS: Hotspot[] = [
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
  const [transform, setTransform] = useState<string>('perspective(1200px) rotateX(0deg) rotateY(0deg)');
  const [spotlight, setSpotlight] = useState<{ x: number; y: number; opacity: number }>({ x: 0, y: 0, opacity: 0 });
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);

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
      {/* Top Window Bar */}
      <div className="screenshot-top-bar">
        <div className="screenshot-traffic-lights">
          <span className="screenshot-t-dot s-red" />
          <span className="screenshot-t-dot s-yellow" />
          <span className="screenshot-t-dot s-green" />
        </div>
        <span>{topBarText}</span>
        <span style={{ color: '#00ff66' }}>● LIVE INTERACTIVE VIEW</span>
      </div>

      {/* Main Image Container with Hotspots */}
      <div className="screenshot-img-wrapper" style={{ position: 'relative', overflow: 'hidden' }}>
        <img
          src="/app-screenshot.png"
          alt="GameSky.space macOS App Screenshot"
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
        {HOTSPOTS.map((h) => {
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
        {captionText}
      </div>
    </div>
  );
};
