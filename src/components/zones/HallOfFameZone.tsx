import React, { useState } from 'react';
import { retroAudio } from '../../audio/retroSynth';

interface BigBoxGame {
  id: string;
  title: string;
  developer: string;
  source: 'FreeDOS 1.4' | 'Internet Archive';
  crc32?: string;
  tag: string;
  accentColor: string;
  mockScreenshot: string;
}

const HALL_GAMES: BigBoxGame[] = [
  {
    id: 'freedos-defender',
    title: 'DOS Defender',
    developer: 'FreeDOS Open Source',
    source: 'FreeDOS 1.4',
    crc32: 'Verified CRC32: 0x9B42A11E',
    tag: 'GPL v2 Freeware',
    accentColor: '#00aa00',
    mockScreenshot: '🚀 👾 💥 🛡️',
  },
  {
    id: 'doom2',
    title: 'DOOM II',
    developer: 'id Software (1994)',
    source: 'Internet Archive',
    tag: 'Shareware / Classic',
    accentColor: '#aa0000',
    mockScreenshot: '👹 🔥 🔫 💀',
  },
  {
    id: 'pre2',
    title: 'Prehistorik 2',
    developer: 'Titus Software (1993)',
    source: 'Internet Archive',
    tag: 'Platformer Legend',
    accentColor: '#aa5500',
    mockScreenshot: '🦖 🍖 🌴 🍌',
  },
  {
    id: 'freedos-chess',
    title: 'GNU Chess DOS',
    developer: 'FreeDOS Project',
    source: 'FreeDOS 1.4',
    crc32: 'Verified CRC32: 0x5C89F102',
    tag: 'Open Source Chess',
    accentColor: '#0055aa',
    mockScreenshot: '♟️ ♞ ♚ ♛',
  },
];

export const HallOfFameZone: React.FC = () => {
  const [selectedGame, setSelectedGame] = useState<BigBoxGame>(HALL_GAMES[0]);
  const [activeScaler, setActiveScaler] = useState<'pixel' | 'crt' | 'hq2x'>('pixel');

  const handleSelectScaler = (scaler: 'pixel' | 'crt' | 'hq2x') => {
    setActiveScaler(scaler);
    retroAudio.playBlip();
  };

  return (
    <div className="zone-container zone-hall" style={{ left: '9600px' }}>
      {/* Zone Signpost */}
      <div className="zone-signpost">
        <div className="signpost-top">SECTOR 06</div>
        <div className="signpost-title">35 FREEDOS &amp; ARCHIVE HALL OF FAME</div>
      </div>

      <div className="hall-rig win-outset">
        <div className="hall-header">
          <span>🏛️ BIG BOX SHOWROOM &amp; VGA SCALER ENGINE</span>
          <span className="hall-badge">35 OFFICIALLY VERIFIED FREEDOS GAMES</span>
        </div>

        {/* Top: 3D Big Box Shelf */}
        <div className="big-box-shelf">
          {HALL_GAMES.map((game) => (
            <div
              key={game.id}
              className={`big-box-card ${selectedGame.id === game.id ? 'box-active' : ''}`}
              style={{ borderColor: game.accentColor }}
              onClick={() => { setSelectedGame(game); retroAudio.playBlip(); }}
            >
              <div className="box-spine" style={{ background: game.accentColor }}>
                <span>{game.source}</span>
              </div>
              <div className="box-face">
                <div className="box-title">{game.title}</div>
                <div className="box-dev">{game.developer}</div>
                <div className="box-tag">{game.tag}</div>
                {game.crc32 && <div className="box-crc">{game.crc32}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom: Live Scaler Comparison Screen */}
        <div className="scaler-demo-area win-inset">
          <div className="scaler-controls-bar">
            <span className="scaler-label">VGA SCALER ENGINE:</span>
            <button
              className={`btn-scaler-toggle ${activeScaler === 'pixel' ? 'scaler-btn-active' : ''}`}
              onClick={() => handleSelectScaler('pixel')}
            >
              Mode 1: Pixel Perfect (320×200)
            </button>
            <button
              className={`btn-scaler-toggle ${activeScaler === 'crt' ? 'scaler-btn-active' : ''}`}
              onClick={() => handleSelectScaler('crt')}
            >
              Mode 2: CRT Scanlines (2x)
            </button>
            <button
              className={`btn-scaler-toggle ${activeScaler === 'hq2x' ? 'scaler-btn-active' : ''}`}
              onClick={() => handleSelectScaler('hq2x')}
            >
              Mode 3: HQ2X Vector Smooth
            </button>
          </div>

          <div className={`scaler-screen-frame scaler-${activeScaler}`}>
            <div className="scaler-game-content">
              <div className="mock-vga-game">
                <div className="mock-sky">{selectedGame.mockScreenshot}</div>
                <div className="mock-title-banner">{selectedGame.title.toUpperCase()} (1990s VGA 256 COLORS)</div>
                <div className="mock-ground">══════════════════════════════════════════════</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
